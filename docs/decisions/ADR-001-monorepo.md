# ADR-001: Monorepo with a modular-monolith backend

Status: accepted · Date: 2026-09 · Author: platform team

## Context

Netram must grow to web, mobile, authority workspaces, control room, CCTV, AI
and realtime without becoming an unmanageable zoo. The architecture requires:
simple architecture first, explicit boundaries, server authority, and durable
state.

## Decision

- Single pnpm + Turborepo workspace.
- `services/api` is a modular monolith owning all application/domain behavior.
- Only `realtime`, `ai`, and `cctv-gateway` exist as separate services, and only
  because their isolation is justified (transport/streaming, model inference,
  provider SDKs).
- Persistence is confined to `packages/data` behind repository interfaces.
- Shared contracts (`types`, `validation`) keep web, mobile and API aligned;
  `openapi.json` is the exported HTTP contract (CI-pinned).
- Providers (auth, CCTV, storage, notifications) sit behind adapters.

## Alternatives considered

- **Full microservices now** — rejected: no demonstrated technical requirement;
  adds operational cost without value at this stage (AGENTS.md §6).
- **Relying on the old implementation** — rejected: it conflicts with the
  authoritative architecture (AGENTS.md §1).
- **No shared packages** — rejected: web+mobile+api genuinely share contracts;
  a junk-drawer is prevented by AGENTS.md §20 rules.

## Consequences

- One lockfile, one `pnpm install`, reproducible local DB lifecycle.
- Enforcing boundaries is done mechanically (`scripts/architecture-check.mjs`)
  and socially (CODEOWNERS).
- Growing the API is additive; splitting it later requires an ADR.
