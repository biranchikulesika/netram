# CCTV / Live Streaming - Current Architecture

**Authority:** this is the single current reference for CCTV in NETRAM. It
describes the system as implemented (Phases 1–5, complete as of 2026-09-23).
Design history, phase-by-phase records, and the pre-build audit live in
[`docs/history/`](../history/) and are not current documentation.

The architectural rule that defines the CCTV subsystem (and that Phase 3
enforced in code):

> **The CCTV Gateway controls the media system. It does not carry media.**

---

## 1. Components

| Component    | Location                                                        | Role                                                                                                  |
| ------------ | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| NETRAM API   | `services/api` (`src/modules/cctv/`, sweeper in `src/workers/`) | Auth, jurisdiction, session records, token lifecycle, audit, outbox, external-auth decision endpoint  |
| CCTV Gateway | `services/cctv-gateway` (Fastify, :3003)                        | Media **control plane only**: path provisioning, health, stats, token verify, reader correlation/kick |
| MediaMTX     | `netram-media` container (`infra/mediamtx/`)                    | The media server: RTSP ingest, fan-out, WebRTC/WHEP, HLS                                              |
| Camera / NVR | facility side                                                   | RTSP source; in dev simulated by `camera-sim` + `facility-nvr` containers (`infra/facility-sim/`)     |
| Web app      | `apps/web`                                                      | Control Room playback UI + same-origin media proxies (`apps/web/app/api/cctv/`)                       |

## 2. Data plane (media bytes)

```
Camera / NVR                (facility network)
    │ RTSP
    ▼
MediaMTX (netram-media)     on-demand pull; fan-out; WHEP :8189, HLS :8888
    │ WebRTC (WHEP) / HLS   (HLS = wall/secondary mode)
    ▼
Browser ◀── same-origin proxies in apps/web ── Control Room UI
```

No video bytes ever traverse the NETRAM API, the CCTV Gateway, or the Node
web server. MediaMTX performs the fan-out: one upstream RTSP source serves N
viewers (runtime-verified: 3 viewers, `readers=3, source=rtspSource`).

## 3. Control plane (no media bytes)

```
Control Room UI
    │ cookie session
    ▼
Next.js same-origin routes (/api/cctv/...)        apps/web
    │ Bearer (service secret)
    ▼
NETRAM API /api/v1/cctv/*                         auth · jurisdiction · audit · outbox
    │ Bearer (service secret)
    ▼
CCTV Gateway /media/*                             path provisioning · health · stats
    │ basic auth
    ▼
MediaMTX control API :9997
```

## 4. Playback flow (WebRTC/WHEP, primary)

1. **Create session** - Control Room →
   `POST /api/cctv/:cameraId/streams` (cookie) → API checks `cctv:stream` +
   jurisdiction, resolves camera config from DB, asks the gateway to provision
   the MediaMTX path, creates the `cctv_streams` row + audit + outbox event
   atomically, returns `{ streamId, playback: { protocol: "webrtc", token,
whepUrl, mediaPath } }`.
2. **Handshake** - browser POSTs its SDP offer to
   `POST /api/cctv/media/whep?path=<mediaPath>&netramSession=<streamId>` with
   `Authorization: Bearer <playback token>`; the web route forwards to
   MediaMTX WHEP server-side (`apps/web/app/api/cctv/media/whep/route.ts`).
3. **Authorisation** - MediaMTX calls the NETRAM external auth hook
   (`POST /media/auth` on the API, secret-gated). The hook validates the hook
   secret, hashes the token (sha256) and checks the session is active,
   unexpired, and path-matched; permits `read`/`playback` for live consumers.
   Decisions are fail-closed and audited (`cctv.media_auth_granted` /
   `cctv.media_auth_denied`).
4. **Play** - `RTCPeerConnection` (recvonly) attaches the MediaStream to
   `<video>` (`apps/web/lib/cctv-player.ts`, driven by
   `apps/web/lib/use-cctv-live-stream.ts`).

## 5. Session lifecycle

- **Playback token** - short-lived TTL (seconds, chosen per session),
  path-bound, stored only as a sha256 hash (`token_hash`); the raw token never
  touches the database. Ended/expired sessions are rejected by the hook, so
  MediaMTX itself refuses new handshakes.
- **Heartbeat** - the player sends `POST /api/cctv/:id/streams/:streamId/heartbeat`
  every 30 s while playing (`HEARTBEAT_INTERVAL_MS` in `use-cctv-live-stream.ts`).
- **Sweeper** - `services/api/src/workers/cctv-sweeper.worker.ts` runs every
  15 s and ends sessions that are token-expired (`expiresAt <= now`) or
  heartbeat-stale (90 s grace = 3 missed heartbeats), with atomic audit +
  outbox records (`endedBy=sweeper`).
- **Termination** - explicit `DELETE /api/cctv/cameras/:id/streams/:streamId`
  (`endReason` recorded, e.g. `viewer_stop`). The API ends the DB session and
  then kicks the MediaMTX reader (below), so the video actually stops.

## 6. Reader correlation & kick

MediaMTX v1.21.1 echoes the WHEP URL query into each WebRTC session record's
`query` field. The player appends `netramSession=<streamId>`; on session end
the API asks the gateway to locate the reader carrying that correlation id and
kick it (`kickReadersByNetramSession` in
`services/cctv-gateway/src/mediamtx/client.ts`, wired into `endStream`). This
closes the loop: **end of session ⇒ MediaMTX reader disconnected** - no
schema extension needed (correlation rides in MediaMTX's own session record).

## 7. HLS (wall / secondary mode)

HLS is the secondary mode for multi-camera walls and thumbnails; WHEP remains
the primary live path. The wall is explicitly user-enabled per tile and
bounded (`MAX_WALL_TILES = 9` in `control-room-layout.tsx`) - a camera being
online never auto-opens sessions.

- Route: `GET /api/cctv/media/hls/<mediaPath>/<file>` → forwards to MediaMTX
  HLS (:8888) with the viewer's playback token on every playlist/segment
  request; `apps/web/lib/hls-playlist.ts` rewrites playlist URIs to
  same-origin proxy URLs (token enforced, session preserved).
- HLS uses the **same** hook-authorised token model as WHEP. Live-verified
  v1.21.1 quirk: for HLS, MediaMTX delivers the token in the hook payload's
  `query` field (WHEP uses `token`); the hook resolves it per-protocol.
- Player: `hls.js` (`apps/web/app/dashboard/control-room/hls-wall-tile.tsx`).

## 8. Health

Health is derived from real media state - never hardcoded:

- MediaMTX path/source state and reader counts (via the gateway's MediaMTX
  client) determine `online` / `degraded` / `offline`; cameras never probed by
  media infrastructure report `unknown`. A DB row alone never means "online".
- Exposed via `GET /api/cctv/cameras/:id/health`; the API has no independent
  media knowledge - it reflects what the gateway reports.

## 9. Camera configuration source

The database (`cctv_cameras`) is the single camera catalogue. The gateway
resolves the media path from the camera's configured endpoint; there is no
hardcoded camera map (removed in Phase 3). The media path is the contract:
above the ingest boundary nothing knows camera IPs, RTSP URLs, or credentials.

## 10. Development simulation rig

```
pnpm run cctv:up   # docker compose --profile facility up -d
```

Runs `camera-sim` (FFmpeg H.264 push) → `facility-nvr` (always-on RTSP) →
`netram-media` (MediaMTX, on-demand pull; `sourceOnDemand` with 10 s start
timeout / 20 s close-after). Cameras seeded with `facility-nvr:8554` endpoints
are watchable end-to-end; `sim.local` endpoints represent unprovisioned
facilities (health: `offline`/`unknown` - intentional honesty, see §8).

Debug page: `/dev/cctv-test` (kept deliberately as a regression tool; uses the
dev proxy `/api/dev/cctv/whep`).

Runtime verification: `pnpm verify:runtime:cctv-phase5` (19 checks incl. real
browser playback), plus phase 2/3/4 suites (`verify:runtime:cctv-phase2|3|4`).

## 11. Security summary

- Browser receives: its own short-lived playback token and nothing else. No
  RTSP URLs, facility IPs, camera credentials, MediaMTX addresses/credentials,
  or service secrets.
- MediaMTX control API (:9997) is basic-auth protected and server-side only.
- Gateway ↔ API and API ↔ gateway calls carry service secrets.
- The external auth hook is fail-closed; every decision is audited without
  token/user material in audit records.
- Public surface is only the web origin; RTSP (:8554), WHEP (:8189), HLS
  (:8888) and the control API bind inside the Docker network (ports published
  for local development only).

## 12. Known limitations / planned work

- **Production facility deployment is NOT implemented**: no WireGuard tunnel,
  no real cameras, no ONVIF provisioning, no TLS/reverse-proxy termination,
  no TURN. The dev rig simulates the facility; production topology design
  lives in [`docs/history/cctv-evolution.md`](../history/cctv-evolution.md).
- Hook secret travels as a query param on the configured hook URL (MediaMTX
  cannot send custom headers) - acceptable for dev; production must move it to
  a secret-managed reverse-proxy front.
- Glass-to-glass latency not yet measured end-to-end (receiver-side
  decomposition measured: jitter buffer ≈ 3–11 ms, RTT ≈ 1 ms;
  `pnpm measure:cctv-latency`; photographic method documented in the script).
- Wall tile cap is a constant, not policy-driven.
- No recording/DVR, PTZ, or AI frame pipeline (deliberately out of scope).
