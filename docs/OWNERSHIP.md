# Ownership

Review responsibility and architectural accountability. Ownership is not
territorial: cross-boundary changes are encouraged but should involve the
relevant owners.

## Team

| Member | GitHub | Primary Areas |
|--------|--------|---------------|
| Biranchi Kulesika | [@biranchikulesika](https://github.com/biranchikulesika) | Final architecture authority, web, core API, data layer, infrastructure, cross-boundary integration |
| Sruti Swarupa Mahapatra | [@srutiswarupa](https://github.com/srutiswarupa) | Inspector mobile UI/workflows, presentation support |
| Smruti Rekha Parida | [@smrutirekhaparida576](https://github.com/smrutirekhaparida576) | Inspector mobile UI/workflows, presentation support |
| Jyotirmaya Behera | [@jyotirmaya2004](https://github.com/jyotirmaya2004) | Core backend/business logic, AI, logic/process tracing, data-layer support |
| Diptesh Ranjan Pradhan | [@dipteshrpradhan](https://github.com/dipteshrpradhan) | AI, CCTV, implementation Q&A, presentation/technical support |
| Bishnu Charan Barik | [@BISHNU-CHARAN-BARIK](https://github.com/BISHNU-CHARAN-BARIK) | Integration, cross-workstream coordination, deployment, documentation |

## Area Ownership

| Area | Owner(s) | Responsibility |
|------|----------|----------------|
| `apps/web` | @biranchikulesika | Next.js platform, Server Components, UI engineering |
| `apps/inspector-mobile` | @srutiswarupa @smrutirekhaparida576 | Expo app, offline/sync operations, idempotency |
| `services/api` | @biranchikulesika @jyotirmaya2004 | REST API, application/domain logic, authorisation, audit, outbox |
| `services/ai` | @dipteshrpradhan @jyotirmaya2004 | Advisory models, anomaly processing, reviewable results |
| `services/cctv-gateway` | @dipteshrpradhan @biranchikulesika | Provider abstraction, authorised stream delivery |
| `services/realtime` | @biranchikulesika @jyotirmaya2004 | Outbox publishing, authorised event delivery |
| `packages/data` | @biranchikulesika | Drizzle/Postgres, repositories, migrations, seed |
| `packages/types` | @biranchikulesika @jyotirmaya2004 | Canonical domain/contract types |
| `packages/validation` | @biranchikulesika @jyotirmaya2004 | Zod validation schemas |
| `packages/api-client` | @biranchikulesika | Typed API client |
| `packages/ui` | @biranchikulesika | Reusable presentation primitives |
| `packages/config` | @biranchikulesika | Centralised validated configuration |
| `infrastructure` | @biranchikulesika @BISHNU-CHARAN-BARIK | Docker/CI, environments, service deployments |

## Rules

- Ownership is review responsibility, not a coding restriction.
- Contributors may work outside their primary area.
- Cross-boundary changes should involve the relevant owner for review.
- Biranchi Kulesika is the final architecture authority.

Enforced through `.github/CODEOWNERS`.
