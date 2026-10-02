# Netram Development Guide

This directory contains the canonical developer guides, local setup procedures, environment matrices, and verification commands for the Netram monorepo.

---

## 1. Quick Navigation

| Document                                 | Purpose                                                                                                  |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **[`setup.md`](setup.md)**               | Step-by-step local workstation installation, database lifecycle, service startup, and mobile emulation.  |
| **[`environments.md`](environments.md)** | Multi-tier environment matrix (`dev`, `ci`, `demo`, `prod`), port allocations, and isolation boundaries. |
| **[`../OWNERSHIP.md`](../OWNERSHIP.md)** | Team members, GitHub handles, area responsibilities, and `.github/CODEOWNERS` rules.                     |
| **[`../../AGENTS.md`](../../AGENTS.md)** | Mandatory engineering operating manual (architectural boundaries, transactions, outbox, disclosure).     |

---

## 2. Essential Development Commands

All commands are run from the monorepo root via `pnpm`:

### Infrastructure & Database

```bash
pnpm infra:up            # Start PostgreSQL 16, Redis 7, and MinIO S3 via Docker Compose
pnpm infra:down          # Stop infrastructure containers
pnpm cctv:up             # Start facility CCTV media simulation (MediaMTX + simulated RTSP cameras)
pnpm cctv:down           # Stop CCTV simulation
pnpm db:setup            # Reset database to zero, run all Drizzle migrations, and seed deterministic data
pnpm db:reset            # Wipe and re-apply migrations from zero (dev only)
pnpm db:seed             # Populate deterministic synthetic seed data
```

### Application Services

```bash
pnpm --filter @netram/api dev               # Core REST API on http://localhost:3001
pnpm --filter @netram/web dev               # Next.js Web Platform on http://localhost:3000
pnpm --filter @netram/realtime dev          # WebSocket Realtime Hub on ws://localhost:3002
pnpm --filter @netram/cctv-gateway dev      # CCTV Media Control Gateway on http://localhost:3003
pnpm --filter @netram/api workers           # Background Worker Pool (Outbox, Notifications, CCTV Sweeper)
pnpm --filter @netram/inspector-mobile dev  # Expo Mobile Development Server
```

---

## 3. Quality & Verification Gates

The CI pipeline runs automated checks against every pull request. Run these locally prior to submitting changes:

```bash
pnpm check:architecture  # Enforces mandatory module boundaries (no DB queries in web/controllers)
pnpm check:security      # Scans for exposed private keys, unapproved secrets, and credentials
pnpm typecheck           # Runs tsc --noEmit across all 11 packages and services
pnpm lint                # ESLint check across all packages
pnpm test                # Vitest unit test suite across all modules
pnpm build               # Production compilation across Next.js and backend services
```

---

## 4. Architectural Rules for Contributors

1. **Server-Side Authority:** Never place business rules or authorization checks inside React components. Application logic belongs in Application Services (`services/api/src/modules/*/application/`).
2. **Persistence Isolation:** Never import Drizzle or execute raw SQL outside `packages/data`. Presentation and API controllers interact solely through Repository Ports.
3. **Deterministic Seeding:** When modifying database schemas, add a numbered Drizzle migration (`pnpm --filter @netram/data db:generate`), verify migration from zero, and update seed scripts accordingly.
