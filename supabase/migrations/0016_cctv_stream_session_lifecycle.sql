-- 0016: CCTV stream session lifecycle (Phase 4).
--
-- Sessions become first-class lifecycle entities (docs/architecture/cctv-phase-4.md):
--   - mediaPath        — MediaMTX path the session's playback token is scoped to
--                        (the media-plane contract; the token carries it and the
--                        external auth hook validates it against this row).
--   - tokenHash        — SHA-256 of the playback token. The plaintext token is
--                        NEVER persisted; the hash identifies the session to the
--                        auth hook without storing bearer material.
--   - lastHeartbeatAt  — refreshed by POST /streams/:id/heartbeat.
--   - expiresAt        — token expiry; the sweeper never ends a session before it.
--   - endedBy          — 'viewer' | 'sweeper' | 'admin' (who drove the end).
--   - endReason        — 'viewer_stop' | 'token_expired' | 'heartbeat_timeout' |
--                        'admin_revoke' (Phase 4 vocabulary).
-- No column is written during the normal start path's hot window beyond what
-- the gateway already returns, so Phase 3 clients keep working (tokenHash and
-- mediaPath are backfilled opportunistically by the API on stream creation).

ALTER TABLE "cctv_streams"
  ADD COLUMN "media_path" varchar(200),
  ADD COLUMN "token_hash" varchar(64),
  ADD COLUMN "last_heartbeat_at" timestamptz,
  ADD COLUMN "expires_at" timestamptz,
  ADD COLUMN "ended_by" varchar(20),
  ADD COLUMN "end_reason" varchar(40);

-- Sweeper + auth-hook lookups run on these predicates every few seconds.
CREATE INDEX IF NOT EXISTS "cctv_streams_sweep_idx"
  ON "cctv_streams" ("status", "expires_at");
CREATE INDEX IF NOT EXISTS "cctv_streams_token_hash_idx"
  ON "cctv_streams" ("token_hash");
