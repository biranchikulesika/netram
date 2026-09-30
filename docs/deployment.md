# Deployment — netram.kulesika.in

Single-VPS deployment of the Netram stack on the host `biranchi`
(`51.79.220.41`, Ubuntu, 11 GB RAM). This document describes the **current**
architecture. Where it disagrees with an older description, this document wins.

## 1. Topology

```
Internet ──▶ nginx  (:80/:443, TLS + Let's Encrypt)        ← the only edge
             │     (already on the host for other tenants)
             ├── https://netram.kulesika.in/*    ──▶ 127.0.0.1:3100  web
             │       pages · same-origin /api/* BFF · CCTV media proxies
             └── https://netram.kulesika.in/ws   ──▶ 127.0.0.1:3202  realtime
                                                        (WebSocket upgrade)

media plane (bypasses the BFF):
  netram-media :8189/udp + :8189/tcp  published publicly — WebRTC media
  (ICE/SRTP) flows browser ↔ MediaMTX directly. Only *signalling* is
  proxied, same-origin, through the web app.

internal only (never published):
  api :3001 · cctv-gateway :3003 · postgres · redis · minio
  MediaMTX :8888 (HLS) and :9997 (control API)
  facility rig: camera-sim + facility-nvr
```

### Why nginx and not the bundled Caddy

`docker-compose.yml` originally shipped a Caddy service that owned `:80/:443`.
That cannot work on this host:

1. nginx already owns `:80/:443` for other tenants, and two TLS terminators
   cannot share a port.
2. A **rootless** container cannot bind a privileged port at all (`<1024`).

nginx therefore remains the single edge and Netram is one more server block on
the shared listeners. Vhosts are selected by SNI/Host, so no other tenant is
affected. The Netram vhost deliberately does **not** declare `default_server` —
the existing default vhost on port 80 belongs to another tenant and must keep
answering unknown `Host` headers.

Config lives in `infra/nginx/`; `scripts/deploy-nginx.sh` installs it.

## 2. Container runtime — Podman, rootless

This deployment runs on **rootless Podman** (`podman-compose`, rootless, no
daemon). Docker is not installed and is not required.

Consequences that shaped the configuration:

| Constraint | Effect |
|---|---|
| Cannot bind `:80`/`:443` | Edge is nginx on the host, not a container |
| `COPY dir ./` flattens `dir`'s contents | All Dockerfiles use an explicit destination (`COPY dir ./dir`) — see §7 |
| `service_completed_successfully` = "stopped" | `podman-compose` does not inspect the exit code of one-shot services; verify `db-setup` by log after deploy |
| Requires `default` network declared | `networks.default` is stated explicitly instead of being synthesised |

## 3. DNS

`netram.kulesika.in` is an **A record pointing directly at `51.79.220.41`**, set
**DNS-only (grey cloud)** in Cloudflare.

DNS-only is required, not a preference:

- Cloudflare's proxy does not forward UDP, so CCTV WebRTC playback (port
  `8189/udp`) would break behind the orange cloud.
- With the record proxied, the origin certificate would also have to be a
  Cloudflare origin cert, and SSL/TLS mode set to *Full (strict)*.

## 4. Environment

- `.env.vps` — the **compose substitution** file, gitignored, holds the real
  secrets. Only parameterises the `environment:` blocks in `docker-compose.yml`.
- `.env.vps.example` — committed template, placeholders only.
- Each service's **runtime** environment is declared in the service's
  `environment:` block, not in the env file.

Secrets are generated per host. Each of these must be ≥ 32 characters and must
match across every service that shares it:

| Secret | Shared between |
|---|---|
| `NETRAM_DEV_AUTH_SECRET` | api · workers · realtime (dev-auth JWT signing) |
| `NETRAM_CCTV_STREAM_SECRET` | api · workers · cctv-gateway (relay tokens) |
| `NETRAM_CCTV_SERVICE_SECRET` | api · workers · cctv-gateway (control plane) |
| `NETRAM_MEDIAMTX_HOOK_SECRET` | api ← mediamtx external auth hook |

## 5. Demo behaviour (deliberate, and not production-ready)

Two behaviours are intentional and must not be mistaken for production design.

**Dev auth provider.** `NETRAM_AUTH_PROVIDER=dev` lets a visitor sign in as any
seeded demo account with no password check. This is a demo affordance, not an
authentication model. Real users require the `supabase` provider.

**30-minute database reset.** `db-reset` loops every
`NETRAM_DEMO_RESET_SECONDS` (default `1800` = 30 min) and rebuilds the database
from migrations plus the deterministic seed:

```
db:reset   → drop schema, apply all migrations from zero
db:seed    → deterministic synthetic seed
```

So every visitor starts from the same coherent state and trial edits
disappear — **including a visitor's own edits if they are mid-task when the
timer fires.** Raise `NETRAM_DEMO_RESET_SECONDS` (e.g. `21600` = 6 h) to reduce
interruptions. The reset guard (`NETRAM_ALLOW_DB_RESET=1`) must be explicitly
set; it stays closed otherwise.

`db-setup` is the one-shot initial build of the same thing, and every
database-reading service waits for it so a fresh volume is never served empty.

## 6. Operating the stack

```bash
# up (first time builds images; takes several minutes)
podman-compose -f docker-compose.yml --env-file .env.vps up -d --build

# status / logs
podman ps -a
podman logs -f netram-api
podman logs netram-db-setup          # one-shot: MUST show success after deploy
podman logs -f netram-db-reset       # the 30-min reset loop

# redeploy after a code change (rebuild + recreate)
podman-compose -f docker-compose.yml --env-file .env.vps up -d --build

# stop / down
podman-compose -f docker-compose.yml --env-file .env.vps down
```

`podman-compose` is installed at `~/.local/bin/podman-compose`, along with its
two pure-Python dependencies (`PyYAML`, `python-dotenv`) in the user
site-packages. The box has no `pip`, so they are vendored by extraction.

### Redeploying one service

`up -d --build` does not recreate containers whose image was unchanged by the
last build, and `podman-compose` does not check the exit code of the `db-setup`
one-shot, so a partial redeploy can silently leave the old image running. After
any build, **wait for it to finish completely**, then recreate explicitly:

```bash
podman-compose -f docker-compose.yml --env-file .env.vps build web   # or: api
podman-compose -f docker-compose.yml --env-file .env.vps \
  up -d --no-build --no-deps --force-recreate web

# confirm the running container really is the image you just built
podman inspect netram-web --format '{{.Image}}'
podman images localhost/netram_web --format '{{.Id}}'
```

The two IDs must match. Recreating mid-build deploys the *previous* image.

### Disk: the rootless image store is not self-cleaning

Each deploy retags `localhost/netram_*:latest` onto a newly built image, which
orphans the old one. Nothing garbage-collects it, so the store grew to 507
images / 66GB and a build died with `no space left on device` while
`/dev/sda1` was 90% full.

A daily prune of *dangling* images is installed as a user timer:

```bash
./scripts/install-prune-timer.sh        # idempotent
systemctl --user start netram-podman-prune.service   # run once now
journalctl --user -u netram-podman-prune.service -n 20 --no-pager
```

It is deliberately conservative:

- runs as the deploying user, so it can only touch the **rootless** store; the
  `pracg` tenant runs root Podman with entirely separate storage;
- `podman image prune` **without** `--all`, so it never removes an image a
  running container references;
- `--filter until=24h`, so an in-flight build cannot lose its layers.

It needs lingering, or it stops when the user logs out:

```bash
sudo loginctl enable-linger "$(id -un)"
```

Manual equivalent, if the timer is not installed:

```bash
podman image prune -f --filter until=24h
```

## 7. Repository changes made for this deployment

| Change | Reason |
|---|---|
| Caddy service removed from `docker-compose.yml`; `infra/caddy/` deleted | `:80/:443` held by host nginx; rootless containers cannot bind them |
| `web` published on `127.0.0.1:3100`, `realtime` on `127.0.0.1:3202` | give the host nginx something to proxy to (host ports 3000/4000 are taken by another tenant) |
| `networks.default` declared explicitly | `podman-compose` does not synthesise the implicit default network |
| `db-setup` one-shot service added; api/workers/realtime wait on it | a fresh volume otherwise has no schema until the first 30-min reset tick |
| All four Dockerfiles use explicit COPY destinations | Buildah's `COPY dir ./` flattens the directory and breaks the pnpm workspace layout |
| `infra/nginx/` + `scripts/deploy-nginx.sh` | edge configuration and its idempotent installer |
| `infra/systemd/` + `scripts/install-prune-timer.sh` | daily dangling-image prune; the rootless image store otherwise fills the disk |

## 8. Troubleshooting

**`netram.kulesika.in` does not resolve** — the Cloudflare A record is missing
or still proxied. `dig +short netram.kulesika.in` must return `51.79.220.41`.

**502 from nginx** — the web container is not publishing.
`ss -tln | grep 3100`. If empty, the stack is down or the published port in
`.env.vps` changed without re-running `up -d`.

**Certificate fails to issue** — ACME needs DNS pointing here *and* `:80`
reachable from the internet. `sudo certbot certonly --webroot -w /var/www/certbot
-d netram.kulesika.in` shows the reason. Note the OVH edge firewall, if
enabled, must allow `:80`, `:443` and `:8189` (udp and tcp).

**CCTV video will not play** — check `:8189/udp` is open in the edge firewall
and that DNS is DNS-only. A proxied DNS record silently breaks WebRTC.

**Build fails with `no space left on device`** — the rootless image store. Check
`podman system df`. The daily prune timer should prevent this; if it has not run
(or is not installed), `podman image prune -f --filter until=24h` frees tens of
GB immediately.
