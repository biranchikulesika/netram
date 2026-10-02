# Deployment - netram.kulesika.in

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
  netram-media :8189/udp + :8189/tcp  published publicly - WebRTC media
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
affected. The Netram vhost deliberately does **not** declare `default_server` -
the existing default vhost on port 80 belongs to another tenant and must keep
answering unknown `Host` headers.

Config lives in `infra/nginx/`; `scripts/deploy-nginx.sh` installs it.

## 2. Container runtime - Podman, rootless

This deployment runs on **rootless Podman** (`podman-compose`, rootless, no
daemon). Docker is not installed and is not required.

Consequences that shaped the configuration:

| Constraint                                   | Effect                                                                                                      |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Cannot bind `:80`/`:443`                     | Edge is nginx on the host, not a container                                                                  |
| `COPY dir ./` flattens `dir`'s contents      | All Dockerfiles use an explicit destination (`COPY dir ./dir`) - see §8                                     |
| `service_completed_successfully` = "stopped" | `podman-compose` does not inspect the exit code of one-shot services; verify `db-setup` by log after deploy |
| Requires `default` network declared          | `networks.default` is stated explicitly instead of being synthesised                                        |

## 3. DNS

`netram.kulesika.in` is an **A record pointing directly at `51.79.220.41`**, set
**DNS-only (grey cloud)** in Cloudflare.

DNS-only is required, not a preference:

- Cloudflare's proxy does not forward UDP, so CCTV WebRTC playback (port
  `8189/udp`) would break behind the orange cloud.
- With the record proxied, the origin certificate would also have to be a
  Cloudflare origin cert, and SSL/TLS mode set to _Full (strict)_.

## 4. Environment

- `.env.vps` - the **compose substitution** file, gitignored, holds the real
  secrets. Only parameterises the `environment:` blocks in `docker-compose.yml`.
- `.env.vps.example` - committed template, placeholders only. **Every `${VAR}`
  in `docker-compose.yml` has a default or a placeholder in the template;
  generate the four shared secrets with `openssl rand -hex 32` and keep each
  one identical across every service that shares it** (table below).
- Each service's **runtime** environment is declared in the service's
  `environment:` block, not in the env file.

Secrets are generated per host. Each of these must be ≥ 32 characters and must
match across every service that shares it:

| Secret                        | Shared between                                  |
| ----------------------------- | ----------------------------------------------- |
| `NETRAM_DEV_AUTH_SECRET`      | api · workers · realtime (dev-auth JWT signing) |
| `NETRAM_CCTV_STREAM_SECRET`   | api · workers · cctv-gateway (relay tokens)     |
| `NETRAM_CCTV_SERVICE_SECRET`  | api · workers · cctv-gateway (control plane)    |
| `NETRAM_MEDIAMTX_HOOK_SECRET` | api ← mediamtx external auth hook               |

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
disappear - **including a visitor's own edits if they are mid-task when the
timer fires.** Raise `NETRAM_DEMO_RESET_SECONDS` (e.g. `21600` = 6 h) to reduce
interruptions. The reset guard (`NETRAM_ALLOW_DB_RESET=1`) must be explicitly
set; it stays closed otherwise.

`db-setup` is the one-shot initial build of the same thing, and every
database-reading service waits for it so a fresh volume is never served empty.

### Seed data

The seed lives in `db/seed/`:

| File                    | Contents                                                                                                                                                                                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`              | Reference data: geography, roles, permissions, authorities, jurisdictions, organisations, programmes, scheme components, finding categories, disclosure policies, users, projects, plus attendance and CCTV simulation setup.                                                                           |
| `ids.ts`                | The `did()` helper. Every id is UUIDv5 over a readable seed key, in one shared namespace.                                                                                                                                                                                                               |
| `project-operations.ts` | Per-project operational history: inspection cycles, observations, findings, evidence, corrective actions, complaints and attachments, funds and releases, expenses and financial documents, risk snapshots, CCTV cameras, oversight video calls, and the offline operations the inspector app replayed. |

Two properties are load-bearing, because the demo database is destroyed and
rebuilt every 30 minutes and another developer must be able to reproduce it:

- **Deterministic.** No `Date.now()`, no randomness, no dependence on Map
  iteration order. Every timestamp is a literal. A fresh reset produces the same
  ids and the same instants, which is what keeps client-generated offline
  operation ids meaningful across restarts.
- **Interconnected.** Findings reference real inspections; corrective actions
  reference those findings; evidence references both; risk snapshots reference
  flags raised against the same inspections. A query for orphans should return
  zero.

**Content is synthetic.** Organisation names follow the official DoSJE social
audit calendar because that calendar is public. Every person, phone number,
email, invoice number, document hash and location is invented, and emails use
the reserved `.dev.netram.in` domain. No real personal information and no real
credentials.

To add project detail, extend the `ProjectSpec` list in
`project-operations.ts` - one entry per project, each carrying its inspection
cycles and finding text. The module expands those into observations, evidence,
corrective actions and risk snapshots. Do not hand-insert derived rows.

Verified per-project depth after a clean `db:setup` (9 projects, 30
inspections, 37 findings, 50 evidence, 34 corrective actions, 29 photos, 13
complaints, 20 risk snapshots, 37 sync operations). `PRJ-PURI-004` is
deliberately empty of operations: it is a `Draft`, and a draft cannot have
inspections, funds or findings.

## 6. Installing the prerequisites

`podman` (5.7) and `podman-compose` both come from Ubuntu's apt repository on
this release. `podman-compose` is installed at `~/.local/bin/podman-compose`
here, along with its two pure-Python dependencies (`PyYAML`,
`python-dotenv`) in the user site-packages - the box has no `pip`, so they
were vendored by extraction. On a fresh host, `sudo apt install podman
podman-compose` gives you both.

The **host needs no Node toolchain to build or run the stack**: every image
installs pnpm itself via `corepack` inside the Dockerfile, and builds run in
containers. Repo working tree: `git clone` + `git checkout develop` is enough
- `.env.vps` is the only file you must create by hand. (Only the optional
`pnpm verify:runtime:*` scripts at the end of the first-deploy sequence need
a host Node toolchain; nothing before them does.)

### First deploy, end to end

```bash
sudo apt install podman podman-compose
git clone <repo-url> netram && cd netram
cp .env.vps.example .env.vps            # then generate the 4 secrets (see §4)
./scripts/install-prune-timer.sh        # daily prune; see §7 Disk
sudo loginctl enable-linger "$(id -un)"        # keeps the timer alive after logout
podman-compose -f docker-compose.yml --env-file .env.vps up -d --build   # 10-20 min
podman logs netram-db-setup             # MUST show migrations + seed success
sudo scripts/deploy-nginx.sh you@example.com   # TLS vhost; DNS must be set (§3)
pnpm verify:runtime:web                 # optional; needs a host Node toolchain
```

The stack is started before `deploy-nginx.sh` on purpose: the installer's
preflight checks that the containers are publishing on loopback and warns
when they are not.

## 7. Operating the stack

```bash
# status / logs
podman ps -a
podman logs -f netram-api
podman logs netram-db-setup          # one-shot: MUST show success after deploy
podman logs -f netram-db-reset       # the 30-min reset loop

# redeploy after a code change - prefer the scoped deploy below
podman-compose -f docker-compose.yml --env-file .env.vps up -d --build

# stop / down
podman-compose -f docker-compose.yml --env-file .env.vps down
```

### Redeploying one service

**Scoped deploy (preferred).** `scripts/deploy-scoped.sh` rebuilds only the
services whose build inputs changed since the last scoped deploy (marker:
`.freebuff/deploy-ref`, gitignored). Inputs are each service's Dockerfile plus
every `COPY` source in it, parsed at run time. Shared Dockerfiles fan out
(api, workers, db-setup and db-reset all build `services/api/Dockerfile`);
root-level files that images copy (`pnpm-lock.yaml`, ...) and compose/env
changes rebuild everything. Without a valid marker it does one full build,
then records HEAD. Inspect the plan first with `--dry-run`. After any build,
**wait for it to finish completely**, then recreate - the script does this for
you, and recreates only what it built:

```bash
scripts/deploy-scoped.sh --dry-run   # show what would rebuild
scripts/deploy-scoped.sh             # scoped build + recreate
podman logs netram-db-setup          # if db-setup was recreated: MUST show success
```

Manual equivalent (also how to force a single service).
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

The two IDs must match. Recreating mid-build deploys the _previous_ image.

### Disk: the rootless image store is not self-cleaning

Each deploy retags `localhost/netram_*:latest` onto a newly built image, which
orphans the old one. Nothing garbage-collects it, so the store grew to 507
images / 66GB and a build died with `no space left on device` while
`/dev/sda1` was 90% full.

A daily prune runs as a user timer (`infra/systemd/netram-podman-prune.{service,timer,sh}`,
installed by `scripts/install-prune-timer.sh`):

- dangling images older than 24 h (the original nightly scope);
- ALL dangling images - same-day build intermediates included - but skipped
  while a build is in flight (an in-flight build's untagged layers must not be
  pruned; the next run reclaims them);
- persistent build cache (`image prune --build-cache`);
- stopped netram containers older than 24 h (one-shot `db-setup` runs) -
  podman's `container prune` has no age filter, so the script inspects
  `FinishedAt` itself.

It is deliberately conservative:

- runs as the deploying user, so it can only touch the **rootless** store; the
  `pracg` tenant runs root Podman with entirely separate storage;
- every image prune is dangling-only (no `--all`), so it never removes an
  image a running container references;
- the same-day pass is build-guarded; the 24 h passes are age-gated.

It needs lingering, or it stops when the user logs out:

```bash
sudo loginctl enable-linger "$(id -un)"
```

Manual equivalent, if the timer is not installed:

```bash
podman image prune -f                      # same-day + older dangling; ONLY with no build running
podman image prune -f --filter until=24h   # conservative subset (yesterday's scope)
```

## 8. Repository changes made for this deployment

| Change                                                                  | Reason                                                                                       |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Caddy service removed from `docker-compose.yml`; `infra/caddy/` deleted | `:80/:443` held by host nginx; rootless containers cannot bind them                          |
| `web` published on `127.0.0.1:3100`, `realtime` on `127.0.0.1:3202`     | give the host nginx something to proxy to (host ports 3000/4000 are taken by another tenant) |
| `networks.default` declared explicitly                                  | `podman-compose` does not synthesise the implicit default network                            |
| `db-setup` one-shot service added; api/workers/realtime wait on it      | a fresh volume otherwise has no schema until the first 30-min reset tick                     |
| All four Dockerfiles use explicit COPY destinations                     | Buildah's `COPY dir ./` flattens the directory and breaks the pnpm workspace layout          |
| `infra/nginx/` + `scripts/deploy-nginx.sh`                              | edge configuration and its idempotent installer                                              |
| `infra/systemd/` + `scripts/install-prune-timer.sh`                     | daily prune (dangling images, build cache, stale one-shot containers); the rootless image store otherwise fills the disk                |
| `scripts/deploy-scoped.sh`                                             | scoped redeploys: rebuild only services whose build inputs changed; full builds on this box take ~10 min and orphan gigabytes of intermediates |

## 9. Troubleshooting

**`netram.kulesika.in` does not resolve** - the Cloudflare A record is missing
or still proxied. `dig +short netram.kulesika.in` must return `51.79.220.41`.

**502 from nginx** - the web container is not publishing.
`ss -tln | grep 3100`. If empty, the stack is down or the published port in
`.env.vps` changed without re-running `up -d`.

**Certificate fails to issue** - ACME needs DNS pointing here _and_ `:80`
reachable from the internet. `sudo certbot certonly --webroot -w /var/www/certbot
-d netram.kulesika.in` shows the reason. Note the OVH edge firewall, if
enabled, must allow `:80`, `:443` and `:8189` (udp and tcp).

**CCTV video will not play** - check `:8189/udp` is open in the edge firewall
and that DNS is DNS-only. A proxied DNS record silently breaks WebRTC.

**Build fails with `no space left on device`** - the rootless image store. Check
`podman system df`. The daily prune timer should prevent this; if it has not
run (or is not installed), `podman image prune -f` can free tens of GB
immediately - but verify no build is running first (`ps aux | grep -E '[p]odman|[b]uildah'`):
without the 24h filter it also prunes an in-flight build's intermediate
layers. Note that same-day debris (today's dangling images) survives
`--filter until=24h`; only the unfiltered prune reclaims it.
