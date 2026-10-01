#!/usr/bin/env bash
#
# Scoped redeploy for the single-VPS podman-compose stack.
#
# `podman-compose up -d --build` rebuilds EVERY buildable service, which on
# this 11 GB RAM box means long builds and orphaned intermediates even when
# only one service's inputs changed. This script rebuilds only the services
# whose build inputs changed since the last deploy:
#
#   * inputs = the service's Dockerfile + every `COPY <src>` source in it
#     (parsed at run time, so Dockerfile edits stay correct automatically)
#   * root-level COPY sources (pnpm-lock.yaml, package.json, ...) and changes
#     to docker-compose.yml or .env.vps are GLOBAL: they rebuild everything
#   * shared Dockerfiles fan out naturally: api, workers, db-setup and
#     db-reset all build services/api/Dockerfile, so an api change recreates
#     all four
#
# Fallbacks (deliberately conservative - they build EVERYTHING):
#   * no previous deploy marker, invalid marker, or not a git repo
#   * any build or recreate step fails (marker is only advanced on success)
#
# Usage:
#   scripts/deploy-scoped.sh              # scoped deploy
#   scripts/deploy-scoped.sh --dry-run    # show what would rebuild, change nothing
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

COMPOSE_FILE=docker-compose.yml
ENV_FILE=.env.vps
# Gitignored, so it never pollutes `git status`.
MARKER=.freebuff/deploy-ref
DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

log() { printf '\n=== %s\n' "$*"; }

command -v git >/dev/null || { echo "git not found" >&2; exit 1; }
command -v podman-compose >/dev/null || { echo "podman-compose not found" >&2; exit 1; }
[[ -f "$COMPOSE_FILE" ]] || { echo "$COMPOSE_FILE not found" >&2; exit 1; }
[[ -f "$ENV_FILE" ]] || { echo "$ENV_FILE not found (compose env file)" >&2; exit 1; }

compose() {
  podman-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

# ---- last deploy reference -------------------------------------------------
if [[ -f "$MARKER" ]] && git rev-parse --verify --quiet "$(cat "$MARKER")" >/dev/null; then
  REF="$(cat "$MARKER")"
else
  if [[ $DRY_RUN -eq 1 ]]; then
    echo "dry-run: no valid deploy marker - a real run would BUILD EVERYTHING once, then record HEAD"
  else
    log "no valid deploy marker - full build, then recording HEAD as the new marker"
    compose up -d --build
    mkdir -p "$(dirname "$MARKER")"
    git rev-parse HEAD > "$MARKER"
    log "deploy complete; marker set to $(git rev-parse --short HEAD)"
  fi
  exit 0
fi

# ---- changed files since the marker (commits + uncommitted + untracked) ----
changed="$( (git diff --name-only "$REF"; git ls-files --others --exclude-standard) | sort -u )"
if [[ -z "$changed" ]]; then
  log "no input changes since $(git rev-parse --short "$REF") - reconciling container state only"
  [[ $DRY_RUN -eq 1 ]] || compose up -d --no-build
  exit 0
fi

# ---- services -> build inputs ----------------------------------------------
# One python process parses compose + every Dockerfile; shell loops do matching.
map_json="$(python3 - "$COMPOSE_FILE" <<'PY'
import json, re, sys, yaml

compose = yaml.safe_load(open(sys.argv[1]))
services = {}
for name, cfg in (compose.get("services") or {}).items():
    build = cfg.get("build")
    if isinstance(build, str):
        build = {"context": build}
    if not build or "dockerfile" not in (build or {}):
        continue
    dockerfile = f"{build.get('context', '.')}/{build['dockerfile']}".lstrip("./")
    sources = []
    try:
        text = open(dockerfile).read()
    except OSError:
        text = ""
    for line in text.splitlines():
        line = line.strip()
        if not line.startswith("COPY") or "--from=" in line:
            continue
        parts = line.split()[1:]
        flags = [p for p in parts if p.startswith("--")]
        operands = [p for p in parts if not p.startswith("--")]
        # COPY <src>... <dest>: drop flags and the destination.
        for src in operands[:-1]:
            src = re.split("[<>*]", src)[0].rstrip("/")
            if src and "://" not in src:
                sources.append(src)
    services[name] = {"dockerfile": dockerfile, "sources": sorted(set(sources))}
print(json.dumps(services))
PY
)"

# ---- classify changed files -------------------------------------------------
# docker-compose.yml / .env.vps are global on purpose. Other root-level files
# are global ONLY if some image COPYs them (pnpm-lock.yaml, package.json,
# ...); everything else (READMEs, tooling config) cannot change an image.
global_inputs='^(docker-compose.yml|\.env\.vps)$'
all_copy_sources="$(python3 -c 'import json,sys; m=json.load(sys.stdin); print("\n".join(sorted({s for v in m.values() for s in v["sources"]})))' <<<"$map_json")"
declare -a to_build=()
any_global=0
svc_names="$(python3 -c 'import json,sys; print(" ".join(json.load(sys.stdin)))' <<<"$map_json")"

for f in $changed; do
  if [[ "$f" =~ $global_inputs ]]; then
    any_global=1
    break
  fi
  if [[ "$f" != */* ]] && echo "$all_copy_sources" | grep -qxF "$f"; then
    any_global=1
    break
  fi
done

log "changes since $(git rev-parse --short "$REF") in $(echo "$changed" | wc -l) file(s)"

if [[ $any_global -eq 1 ]]; then
  log "global input changed - rebuilding ALL buildable services"
  to_build=($svc_names)
else
  for svc in $svc_names; do
    df="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["'"$svc"'"]["dockerfile"])' <<<"$map_json")"
    srcs="$(python3 -c 'import json,sys; print("\n".join(json.load(sys.stdin)["'"$svc"'"]["sources"]))' <<<"$map_json")"
    hits="$( { echo "$df"; echo "$srcs"; } | while read -r input; do
        [[ -z "$input" ]] && continue
        if echo "$changed" | grep -qx "$input" || echo "$changed" | grep -qx "$input/.*"; then
          echo "$input"
        fi
      done)"
    if [[ -n "$hits" ]]; then
      log "  $svc: changed -> $(echo "$hits" | tr '\n' ' ')"
      to_build+=("$svc")
    fi
  done
fi

if [[ ${#to_build[@]} -eq 0 ]]; then
  log "no buildable service inputs changed - reconciling container state only"
  [[ $DRY_RUN -eq 1 ]] || compose up -d --no-build
  exit 0
fi

log "building: ${to_build[*]}"
if [[ $DRY_RUN -eq 1 ]]; then
  echo "dry-run: would run: compose build ${to_build[*]}"
  echo "dry-run: then:       compose up -d --no-build --no-deps --force-recreate ${to_build[*]}"
  exit 0
fi

# ---- build, wait for completion, THEN recreate (see docs/deployment.md) ----
compose build "${to_build[@]}"
compose up -d --no-build --no-deps --force-recreate "${to_build[@]}"

mkdir -p "$(dirname "$MARKER")"
git rev-parse HEAD > "$MARKER"
log "deploy complete; marker advanced to $(git rev-parse --short HEAD)"
log "verify db-setup if it was recreated: podman logs netram-db-setup"
