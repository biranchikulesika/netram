# Architecture

## System shape

A modular monolith backend with services separated only where the boundary is
justified by the architecture (AGENTS.md §7):

```
                 ┌─────────────────────────────┐
   Web (Next.js) │      inspector-mobile       │
                 └──────────────┬──────────────┘
                                │ packages/api-client (typed)
                 ┌──────────────▼──────────────┐
                 │   services/api   REST /api/v1│  ← authority for app behavior
                 └───────┬───────────┬─────────┘
                  …… app/domain services │
                 ┌───────▼───────────┬─────────┐
                 │ repository interfaces       │
                 └───────┬───────────┴─────────┘
                 ┌───────▼─────────────────────┐
                 │ packages/data  Drizzle/Postgres
                 └─────────────────────────────┘

   services/realtime   outbox → poller → WS   (delivery, never truth)
   services/ai         advisory anomaly review
   services/cctv-gateway provider-abstracted stream relay
```

## Mandatory boundaries

1. **Data access** lives in `packages/data` only — Drizzle, `postgres`, SQL,
   and transactions never appear in apps or other services.
2. **Config** flows through `packages/config` (`loadServerEnv`,
   `loadClientEnv`, …). No scattered `process.env`.
3. **Cross-service communication** happens through explicit contracts (HTTP,
   typed packages, events), never source imports.
4. **The server owns truth.** Realtime messages, AI output, and client state
   are never authoritative.
5. **Specialized services** (ai, cctv-gateway, realtime) sit behind
   interfaces/contracts; no vendor leaks into the core domain.

## Events

Important durable state + publication intent uses the outbox table. A poller
(`services/realtime`) publishes to subscribers; consumers tolerate duplicate
delivery and resync from the API.

## Failure of the old architecture

Where previous code conflicts with the current architecture, the new
architecture wins and the old code is migration debt — never a template
(AGENTS.md §1).

See `docs/decisions/` for the trade-offs made so far.
