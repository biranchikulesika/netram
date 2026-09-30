#!/usr/bin/env bash
#
# Install the netram.kulesika.in nginx vhost on this host.
#
# MUST be run as root (it writes to /etc/nginx and /etc/letsencrypt):
#
#     sudo scripts/deploy-nginx.sh you@example.com
#
# Why this exists: this host already runs nginx for other tenants, so Netram is
# added as one more server block on the shared :80/:443 listeners rather than
# running a second TLS terminator (Caddy) that cannot share the port. A
# rootless container cannot bind :80/:443 at all.
#
# Two-phase install:
#   1. bootstrap vhost (plain HTTP) so the ACME HTTP-01 challenge is servable
#      before a certificate exists (nginx refuses to start on a missing cert);
#   2. certbot issues the certificate;
#   3. final vhost (HTTP redirect + HTTPS reverse proxy) replaces the bootstrap.
#
# Idempotent: safe to re-run. Re-running re-issues nothing if the cert is valid.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOMAIN="${NETRAM_DOMAIN:-netram.kulesika.in}"
ACME_EMAIL="${1:-}"
CERTBOT_WEBROOT=/var/www/certbot
CERT_NAME="$DOMAIN"
AVAIL="/etc/nginx/sites-available/$DOMAIN"
ENABLED="/etc/nginx/sites-enabled/$DOMAIN"
HOOK="/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "ERROR: run as root:  sudo $0 <acme-email>" >&2
  exit 1
fi

log() { printf '\n=== %s\n' "$*"; }

# ---------------------------------------------------------------- preflight
log "Preflight"
for port in 80 443; do
  if ! ss -tln 2>/dev/null | grep -q ":$port "; then
    echo "ERROR: nothing is listening on :$port — this script assumes nginx already owns it." >&2
    exit 1
  fi
done
echo "nginx owns :80/:443  OK"

# The podman containers must already be up and publishing on loopback.
for spec in "3100:web" "3202:realtime"; do
  port="${spec%%:*}"; what="${spec##*:}"
  if ! ss -tln 2>/dev/null | grep -q "127.0.0.1:$port "; then
    echo "WARNING: nothing on 127.0.0.1:$port — the $what container is not publishing." >&2
    echo "         Start the stack first:  podman-compose -f docker-compose.yml --env-file .env.vps up -d" >&2
  else
    echo "127.0.0.1:$port  OK ($what)"
  fi
done

mkdir -p "$CERTBOT_WEBROOT/.well-known/acme-challenge"
chmod -R 755 "$CERTBOT_WEBROOT"

# ------------------------------------------------- 1. bootstrap HTTP vhost
log "1/4  Installing bootstrap (HTTP-only) vhost"
install -m 0644 "$REPO_DIR/infra/nginx/netram-bootstrap.conf" "$AVAIL"
ln -sfn "$AVAIL" "$ENABLED"
nginx -t
systemctl reload nginx
echo "bootstrap vhost live on http://$DOMAIN"

# ------------------------------------------------------------- 2. certificate
log "2/4  Obtaining TLS certificate for $DOMAIN"
if [[ -f "/etc/letsencrypt/live/$CERT_NAME/fullchain.pem" ]]; then
  echo "Certificate already exists — skipping issuance."
  certbot renew --cert-name "$CERT_NAME" || true
else
  if [[ -z "$ACME_EMAIL" ]]; then
    echo "ERROR: no ACME email given. Usage: sudo $0 you@example.com" >&2
    exit 1
  fi
  # Pre-flight the DNS delegation: ACME cannot be solved if the record does not
  # point at this host. Fail loudly here rather than after a rate-limit wait.
  resolved="$(getent hosts "$DOMAIN" | awk '{print $1}' | head -1 || true)"
  host_ip="$(curl -fsS --max-time 10 https://api.ipify.org || true)"
  if [[ -z "$resolved" ]]; then
    echo "ERROR: $DOMAIN does not resolve. Add the DNS A record first." >&2
    exit 1
  fi
  if [[ -n "$host_ip" && "$resolved" != "$host_ip" ]]; then
    echo "ERROR: $DOMAIN resolves to $resolved but this host's public IP is $host_ip." >&2
    echo "       (If Cloudflare is proxying, DNS-only is required for WebRTC and for this check.)" >&2
    exit 1
  fi
  echo "DNS OK: $DOMAIN -> $resolved"

  certbot certonly \
    --webroot -w "$CERTBOT_WEBROOT" \
    -d "$DOMAIN" \
    --email "$ACME_EMAIL" \
    --agree-tos \
    --non-interactive \
    --keep-until-expiring
fi

# ------------------------------------------------------ 3. final HTTPS vhost
log "3/4  Installing final vhost (HTTP -> HTTPS + reverse proxy)"
[[ -f "/etc/letsencrypt/live/$CERT_NAME/fullchain.pem" ]] || {
  echo "ERROR: certificate missing at /etc/letsencrypt/live/$CERT_NAME — aborting." >&2
  exit 1
}
install -m 0644 "$REPO_DIR/infra/nginx/netram.conf" "$AVAIL"
nginx -t
systemctl reload nginx

# ------------------------------------------------------------ 4. renew hook
log "4/4  Installing certificate renewal reload hook"
# certbot renew does not reload nginx on its own; without this the renewed
# certificate is never served.
cat >"$HOOK" <<'HOOKEOF'
#!/bin/sh
# Reload nginx so a renewed certificate is actually served.
systemctl reload nginx
HOOKEOF
chmod 0755 "$HOOK"

# certbot's own timer renews twice daily; make sure it is armed.
systemctl enable --now certbot.timer >/dev/null 2>&1 || \
  systemctl list-timers certbot.timer --no-pager || true

log "Done"
cat <<EOF
  https://$DOMAIN/     -> 127.0.0.1:3100  (web)
  https://$DOMAIN/ws   -> 127.0.0.1:3202  (realtime)

  Verify:
    curl -sS -o /dev/null -w '%{http_code}\n' https://$DOMAIN/
    nginx -t && systemctl status nginx --no-pager | head -3

  Renewal:  certbot renew --dry-run
EOF
