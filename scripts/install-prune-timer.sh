#!/usr/bin/env bash
# Installs the daily dangling-image prune for the Netram rootless Podman store.
#
# Why this exists: every deploy retags localhost/netram_*:latest onto a freshly
# built image, orphaning the previous one. Those untagged images are never
# garbage-collected on their own, so the store grew to 507 images / 66GB and the
# next build died with "no space left on device".
#
# Scope and safety:
#   * Runs as the deploying user, so it can only ever touch the ROOTLESS store.
#     The pracg tenant runs root Podman and has entirely separate storage.
#   * `podman image prune` (no --all) never removes an image that a container
#     references, so running containers are safe.
#   * --filter until=24h leaves an image created in the last day alone, so an
#     in-flight build cannot have its layers pulled out from under it.
#
# Requires lingering to be enabled, otherwise the user systemd manager (and this
# timer) stops when the user logs out:
#     sudo loginctl enable-linger "$(id -un)"
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UNIT_DIR="${REPO_ROOT}/infra/systemd"
USER_UNIT_DIR="${HOME}/.config/systemd/user"
SERVICE="netram-podman-prune.service"
TIMER="netram-podman-prune.timer"

if ! command -v podman >/dev/null 2>&1; then
  echo "podman not found on PATH." >&2
  exit 1
fi

mkdir -p "${USER_UNIT_DIR}"
install -m 0644 "${UNIT_DIR}/${SERVICE}" "${USER_UNIT_DIR}/${SERVICE}"
install -m 0644 "${UNIT_DIR}/${TIMER}" "${USER_UNIT_DIR}/${TIMER}"

systemctl --user daemon-reload
systemctl --user enable --now "${TIMER}"

if [[ "$(loginctl show-user "$(id -un)" -p Linger --value)" != "yes" ]]; then
  cat >&2 <<'EOF'

WARNING: lingering is not enabled for $(id -un), so this timer will stop
running when you log out. Re-run this script as root, or enable it once:

    sudo loginctl enable-linger $(id -un)

EOF
fi

echo "Installed ${TIMER}."
systemctl --user list-timers "${TIMER}" --no-pager
echo
echo "Run it once now with:  systemctl --user start ${SERVICE}"
echo "Check the log with:    journalctl --user -u ${SERVICE} -n 20 --no-pager"
