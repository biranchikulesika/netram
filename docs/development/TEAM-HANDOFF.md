# Netram Team Handoff

How the team works in parallel on the Netram repository.

## Quick start (new developer)

1. Read this file.
2. Read `docs/OWNERSHIP.md` for team roles.
3. Read the architectural context in `docs/architecture/` and `AGENTS.md`.
4. Read `AGENTS.md` for engineering rules.
5. Read `docs/development/setup.md` for environment setup.
6. Go to [Work Areas](#work-areas) and find your assigned area.
7. Read the area's file scope, contracts, and dependencies.
8. Run `pnpm db:setup` to reset the local database to a known state.
9. Start working.

## Principles

- **One codebase, not five repos.** Every developer works in the same monorepo.
- **Contract-first.** Shared types (`packages/types`) and validation (`packages/validation`) are the source of truth for cross-area communication.
- **Server is authority.** Clients (web, mobile) read authoritative state from the API; realtime is delivery only.
- **No area owns another area's domain files.** You can depend on published contracts; you cannot rewrite another area's application logic without their review.
- **Merge requires area owner approval.** If your PR touches files in another area's scope, that area's owner must approve.

## Area ownership

| Area | Owner(s) | Files |
|------|----------|-------|
| **Web Platform** | @biranchikulesika | `apps/web/**`, `packages/ui/**` |
| **Inspector Mobile** | @srutiswarupa @smrutirekhaparida576 | `apps/inspector-mobile/**` |
| **Core API + Data** | @biranchikulesika @jyotirmaya2004 | `services/api/**`, `packages/data/**`, `packages/types/**`, `packages/validation/**`, `packages/config/**` |
| **AI + CCTV + Realtime** | @dipteshrpradhan @jyotirmaya2004 | `services/ai/**`, `services/cctv-gateway/**`, `services/realtime/**` |
| **Integration + Infrastructure** | @BISHNU-CHARAN-BARIK | `infrastructure/**`, `.github/**`, `scripts/**`, `docs/**` |

See [WORK-AREAS.md](./WORK-AREAS.md) for detailed file scope per area.

## Working rules

### Parallel safety

```
AREA_B cannot write AREA_A's application/domain files.
AREA_B can depend on AREA_A's published contracts.
AREA_B can propose changes to AREA_A's routes (requires AREA_A review).
AREA_B must not merge to develop without AREA_A owner approval.
```

### Branch model

Git branching is governed by AGENTS.md §68. Summary:

- `production` is the only permanent branch.
- Release cycle branches: temporary `preview` (from `production`) and `develop`
  (from `preview`).
- Each developer works on a feature branch off `develop`. Never push directly
  to `production`, `preview`, or `develop`.
- Integration is strictly `feature/* → develop → preview → production`, each
  step via Pull Request + Squash and Merge, deleting the source branch.

```
feature/<short-description>
```

Examples:
```
feature/cctv-streaming
feature/attendance-sync
feature/admin-dashboard
feature/evidence-upload
```

### Commit messages

Follow conventional commits:
```
feat(mobile): add offline evidence capture queue
fix(api): correct finding state transition from draft to submitted
chore(infra): add cctv-emulator to docker-compose
```

### Code review

- **Self-review** your own PR before requesting review.
- **Area owner review** required for any change touching another area's files.
- **Architecture review** required for changes touching shared contracts, data layer, or infrastructure.
- All CI checks must pass before merge.

### Shared contract changes

If you need to change `packages/types`, `packages/validation`, or `packages/api-client`:

1. Open a draft PR with just the contract change.
2. Tag the affected area owners.
3. Get approval.
4. Update consumers (API routes, client calls, validation schemas) in the same PR or a follow-up PR.
5. Never merge a contract change that breaks consumers.

## Architecture reference

| Document | Purpose |
|----------|---------|
| `AGENTS.md` | Authoritative operating specification + engineering rules |
| `docs/architecture/README.md` | Architecture overview |
| `docs/domain/README.md` | Domain model reference |
| `docs/contracts/README.md` | API contract inventory (73 routes) |
| `docs/OWNERSHIP.md` | Team roles and area ownership |
| `docs/development/setup.md` | Environment setup |

## Verification commands

```bash
pnpm typecheck          # Type-check all packages
pnpm lint               # Lint all packages
pnpm test               # Run all unit tests
pnpm build              # Build all packages
pnpm check:architecture # Architecture boundary checks
pnpm check:security     # Secret/security scan
pnpm api:export-openapi # Export OpenAPI spec (idempotent)
```

Runtime verifiers (require running services):

```bash
pnpm verify:runtime:web       # Web SSR + evidence + realtime
pnpm verify:runtime:mobile    # Offline sync + idempotency
pnpm verify:runtime:evidence  # Evidence capture + integrity
pnpm verify:runtime:cctv      # CCTV gateway + stream abstraction
pnpm verify:runtime:workers   # Worker pool + outbox dispatch
```

See `docs/development/setup.md` for full service startup instructions.

## Getting help

- Architecture questions: ask @biranchikulesika.
- Domain/business logic questions: ask @jyotirmaya2004.
- AI/CCTV questions: ask @dipteshrpradhan.
- Mobile/offline questions: ask @srutiswarupa.
- Infrastructure/deployment questions: ask @BISHNU-CHARAN-BARIK.
