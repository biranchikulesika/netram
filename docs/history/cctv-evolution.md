# CCTV Subsystem Evolution: Audit, Design, and Implementation Record

> **Historical Record:** This document compiles the architectural evolution of the Netram CCTV subsystem from the initial as-built audit through the 5 implementation phases.
> For the active, canonical architecture reference, consult [`docs/architecture/cctv.md`](../architecture/cctv.md).

---

## 1. Executive Summary & Core Principle

The Netram CCTV subsystem was re-architected to enforce a fundamental system boundary:

> **The CCTV Gateway controls the media system. It does not carry media.**

Prior to this re-architecture, the CCTV gateway was an in-process media proxy that spawned per-viewer FFmpeg processes to transcode and stream video over HTTP, which created extreme CPU saturation, unbound connection growth, and unauthenticated media access.

The modern architecture establishes:

1. **Separation of Planes:** MediaMTX serves as the dedicated media data plane (RTSP ingestion, WebRTC/WHEP egress, and HLS fallback). The CCTV Gateway operates strictly as a control-plane bridge (path provisioning, stats, health checks).
2. **Stateless Media Ingest & Edge Security:** Cameras stream RTSP inside private networks or VPNs; raw camera credentials and endpoints never transit public internet or reach client browsers.
3. **Cryptographically Bound Playback Tokens:** Browsers receive short-lived, HMAC-signed playback tokens bound to explicit MediaMTX paths (`mediaPath`).
4. **Fail-Closed External Auth:** MediaMTX validates playback and publishing via an external HTTP auth hook against active database session records.
5. **Audited Session Lifecycle:** Session creation, heartbeat keep-alives, explicit terminations, and automatic sweeper reaps are persisted and audited.

---

## 2. Phase 0: The As-Built Audit (Pre-Existing Flaws)

An exhaustive audit of the initial prototype identified critical systemic defects:

| Problem Area               | Initial State Defect                                                                                 | Architectural Remedy                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Data Plane Relay**       | Gateway spawned a per-viewer `ffmpeg` child process piping MPEG-TS over HTTP.                        | Delegated data plane to MediaMTX. No video bytes traverse Node.js or Fastify.               |
| **Split-Brain Catalogue**  | Hardcoded static UUID dictionary in `SimulatedCameraProvider` diverged from PostgreSQL database IDs. | Centralized camera records in PostgreSQL via Drizzle ORM as the single source of truth.     |
| **Dishonest Health State** | Health endpoints returned hardcoded `{ status: "online" }` without probing device reachability.      | Implemented real MediaMTX path reader metrics and TCP/RTSP reachability verification.       |
| **Zombie Streams**         | No heartbeat or expiry; rows stayed `status = "active"` indefinitely in the database.                | Introduced 120s TTL, 30s client heartbeats, and background sweeper worker (`cctv-sweeper`). |
| **Credential Leakage**     | Raw RTSP URLs and credentials risked exposure to clients.                                            | Media paths are abstracted; clients receive only signed WHEP endpoints and session tokens.  |

---

## 3. Architecture Target & Requirements

### 3.1 Key Requirements

- **R1: Zero-Plugin Browser Playback:** Native HTML5 `<video>` via standard WebRTC WHEP (< 500ms latency) and HLS fallback.
- **R2: NAT / Firewall Traversal:** Facility cameras reside on private LANs behind NAT; gateway does not assume public camera IP reachability.
- **R3: Strict Jurisdiction Scoping:** Officers can only access cameras belonging to projects within their assigned jurisdiction.
- **R4: Append-Only Audit:** Every stream request and authorization decision records an append-only audit log entry.
- **R5: Resource Conservation (Fan-Out):** One upstream RTSP camera feed serves $N$ concurrent browser viewers via MediaMTX fan-out without duplicate camera connections.

### 3.2 Target Ingestion & Playback Pipeline

```
Facility Network (Private LAN)            Network Perimeter              Netram Platform (Cloud/VPS)
┌──────────────────────────────┐                                    ┌───────────────────────────────────┐
│ IP Camera / NVR (RTSP Stream)│ ──[On-Demand RTSP Pull via VPN]──▶ │ MediaMTX (netram-media)           │
└──────────────────────────────┘                                    │  * WHEP Server (:8189 UDP/TCP)    │
                                                                    │  * HLS Server  (:8888 TCP)        │
                                                                    └─────────────────┬─────────────────┘
                                                                                      │
                                                                        WebRTC WHEP   │ WebRTC Signalling
                                                                        Media Packets │ (Proxied via Web)
                                                                                      │
                                                                    ┌─────────────────▼─────────────────┐
                                                                    │ Control Room UI (apps/web)        │
                                                                    │  * HTML5 <video>                  │
                                                                    │  * 30s Heartbeat Keep-Alive       │
                                                                    └───────────────────────────────────┘
```

---

## 4. Implementation Evolution (Phases 1 through 5)

### Phase 1 & 2: Media Rig & Browser Playback Proof

- Built a reproducible development media rig utilizing Docker Compose:
  - `facility-nvr`: Stand-in NVR server pushing simulated RTSP streams.
  - `camera-sim`: Real-time FFmpeg loop streaming H.264 video.
  - `netram-media`: MediaMTX instance configured with on-demand source pulling.
- Created proof-of-concept WHEP proxy (`/api/dev/cctv/whep`) and client playback controller verifying sub-second latency in headless Chromium via Chrome DevTools Protocol (CDP).

### Phase 3: Gateway as Media Control Bridge

- Removed `ffmpeg` and `ffmpeg-static` from `services/cctv-gateway`.
- Built `MediaMtxClient` and `MediaControlService` in the gateway:
  - Dynamic on-demand path provisioning (`paths/add`).
  - Active path metrics collection (`paths/get`, readers count).
  - Health probe integration (`/media/health`).
- Implemented service-to-service authentication using `x-netram-service-secret`.
- Replaced raw streaming URLs with structured WebRTC stream contracts.

### Phase 4: Session Lifecycle & External Auth Hook

- **Schema Migration (`0016_cctv_lifecycle.sql`):** Added `media_path`, `token_hash`, `last_heartbeat_at`, `expires_at`, `ended_by`, and `end_reason` to `cctv_streams`.
- **Cryptographic Playback Tokens:** Stream tokens signed with HMAC-SHA256, carrying expiry and `mediaPath` claims.
- **Fail-Closed External Auth:** MediaMTX configured with `externalAuthenticationURL` pointing to `POST /media/auth` on `services/api`. The hook verifies token hash, unexpired session status, and path matching before granting read access.
- **Liveness Heartbeats:** `POST /api/v1/cctv/cameras/:id/streams/:streamId/heartbeat` keeps active sessions alive.

### Phase 5: Production Control Room Integration & Sweeper Worker

- **Production Player Controller:** Created `apps/web/lib/cctv-player.ts` with clean `RTCPeerConnection` connection lifecycle, automatic ice gathering, and StrictMode safe teardown.
- **React Hook:** Implemented `use-cctv-live-stream.ts` managing session allocation, 30s background heartbeats, and graceful disconnect (`DELETE /api/v1/cctv/cameras/:id/streams/:streamId`).
- **Background Sweeper Worker:** Implemented `CctvStreamSweeper` (`services/api/src/workers/cctv-sweeper.worker.ts`), polling periodically to:
  1. Detect sessions where `last_heartbeat_at` has lapsed past the 90s threshold.
  2. Terminate zombie streams in the database with `ended_by = "sweeper"` and `end_reason = "heartbeat_timeout"`.
  3. Kick stale WebRTC readers via the gateway (`POST /media/sessions/:mediaPath/kick`).
  4. Emit audit log events (`cctv.stream_ended`).
- **Comprehensive Runtime Verification:** 19/19 checks automated in `scripts/verify-cctv-phase-5.ts` validating complete end-to-end multi-viewer fan-out, heartbeat updates, fail-closed auth, and sweeper terminations.

---

## 5. Summary of Key Architectural Artifacts

| Concern                     | Primary Implementation File                                         |
| --------------------------- | ------------------------------------------------------------------- |
| **Authoritative CCTV Spec** | [`docs/architecture/cctv.md`](../architecture/cctv.md)              |
| **Media Server Config**     | `infra/mediamtx/mediamtx.yml`                                       |
| **Control Bridge Service**  | `services/cctv-gateway/src/mediamtx/media-control-service.ts`       |
| **External Auth Hook**      | `services/api/src/modules/cctv/http/routes.ts` (`/media/auth`)      |
| **Background Sweeper**      | `services/api/src/workers/cctv-sweeper.worker.ts`                   |
| **Browser WebRTC Player**   | `apps/web/lib/cctv-player.ts` & `use-cctv-live-stream.ts`           |
| **Verification Suite**      | `scripts/verify-cctv-runtime.ts` & `scripts/verify-cctv-phase-5.ts` |
