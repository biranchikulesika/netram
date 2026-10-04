#!/usr/bin/env bash
#
# Netram rootless-podman store prune (run by netram-podman-prune.{service,timer}).
#
# Scope, in order of risk:
#   1. dangling images older than 24h      - the original nightly scope
#   2. dangling images of ANY age          - reclaims same-day build
#                                            intermediates; skipped while a
#                                            build is in flight
#   3. persistent build cache              - --mount=type=cache leftovers
#   4. stopped netram containers > 24h old - one-shot db-setup runs pile up
#
# Safety invariants (do not weaken):
#   * Dangling-only image prunes (no --all): an image a container references
#     is never removed, so the running stack cannot be affected.
#   * Pass 2 is skipped when a build is running: an in-flight build's
#     intermediate layers are untagged, and pruning them mid-build corrupts
#     the build. The next daily run reclaims them instead.
#   * Runs as the deploying user, so it can only ever touch the ROOTLESS
#     store; other tenants (e.g. pracg, root Podman) are separate storage.
#   * Container sweep is label-scoped to the netram compose project and
#     age-gated to 24h, so a one-shot that just ran is left alone (its log
#     may still need inspection after a deploy).
set -euo pipefail

PROJECT_LABEL="com.docker.compose.project=netram"
MAX_CONTAINER_AGE_SECONDS=$((24 * 60 * 60))
now=$(date +%s)

log() { printf '[netram-prune] %s\n' "$*"; }

# ---- 1. dangling images older than a day ---------------------------------
log "pruning dangling images older than 24h"
podman image prune --force --filter until=24h

# ---- 2. same-day build intermediates --------------------------------------
# Every deploy retags localhost/netram_*:latest onto freshly built images,
# orphaning the previous set immediately - not tomorrow, when the age-gated
# pass would finally see them. A dangling-only prune is safe (no container
# references them), EXCEPT while a build is in flight.
if pgrep -u "$(id -u)" -f '(podman (-[^ ]+ )*build|buildah)' >/dev/null 2>&1; then
  log "build in flight - skipping same-day dangling prune (next run reclaims it)"
else
  log "pruning all dangling images (same-day build intermediates included)"
  podman image prune --force
fi

# ---- 3. persistent build cache --------------------------------------------
# Only populated by --mount=type=cache builds; harmless to always ask.
log "pruning persistent build cache"
podman image prune --force --build-cache

# ---- 4. stopped netram containers older than a day ------------------------
removed=0
for id in $(podman ps -a \
    --filter "label=${PROJECT_LABEL}" \
    --filter status=exited \
    --format '{{.ID}}'); do
  finished_at="$(podman inspect --format '{{.State.FinishedAt}}' "$id")"
  # FinishedAt is RFC 3339 with nanoseconds; GNU date parses it directly.
  finished_epoch="$(date -ud "$finished_at" +%s 2>/dev/null || echo "$now")"
  age=$((now - finished_epoch))
  if [ "$age" -ge "$MAX_CONTAINER_AGE_SECONDS" ]; then
    if podman rm "$id" >/dev/null; then
      removed=$((removed + 1))
    fi
  fi
done
log "removed ${removed} stopped container(s) older than 24h"

# ---- summary --------------------------------------------------------------
podman system df
