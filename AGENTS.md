# AGENTS.md

# Netram Engineering Operating Manual

This file defines the mandatory engineering rules for the Netram repository.

`AGENTS.md` is the authoritative operating specification. Architectural context
and rationale live under `docs/` (`docs/architecture`, `docs/domain`,
`docs/contracts`, `docs/decisions`); where they conflict with this file, this
file wins.

This file defines operational rules, engineering boundaries, repository conventions,
development practices, verification requirements, and agent behavior.

---

# 1. AUTHORITY AND PRIORITY

When making engineering decisions, follow this order:

1. This `AGENTS.md` (and the architectural context in `docs/`)
2. Existing repository implementation
3. Individual task instructions

If existing code conflicts with the new architecture:

    THE NEW ARCHITECTURE WINS.

Do not preserve an old implementation merely because it already exists.

Do not introduce compatibility layers solely to preserve obsolete architecture.

Do not infer architectural requirements from legacy code.

The repository is actively being migrated toward the new Netram architecture.
Treat obsolete architecture as technical debt, not as precedent.

## Critical rule

The following are NOT authoritative:

- old architecture decisions
- old manuals
- obsolete terminology
- previous agent implementation decisions
- existing directory structure when it conflicts with the new architecture
- legacy database design when it conflicts with the new domain model
- vendor-specific implementation patterns that leak into the application

When uncertain, inspect the current architecture (this file and `docs/`) before inventing a solution.

---

# 2. CORE ENGINEERING PRINCIPLE

Build the simplest architecture that correctly satisfies Netram's requirements.

Do not introduce complexity merely because it is technically possible.

Prefer:

    modular monolith > unnecessary microservices
    interfaces > vendor coupling
    explicit contracts > implicit assumptions
    durable state > transient state
    server authority > client authority
    reusable primitives > duplicated implementations
    deterministic workflows > hidden magic
    boring infrastructure > unnecessary infrastructure

Every architectural decision should answer:

1. What problem does this solve?
2. Why is this boundary necessary?
3. Why is this simpler than the alternatives?
4. Does it preserve the Netram architecture?

---

# 3. REPOSITORY ARCHITECTURE

The repository follows this high-level structure:

    netram/
    ├── apps/
    │   ├── web/
    │   └── inspector-mobile/
    │
    ├── services/
    │   ├── api/
    │   ├── ai/
    │   ├── cctv-gateway/
    │   └── realtime/
    │
    ├── packages/
    │   ├── data/
    │   ├── types/
    │   ├── validation/
    │   ├── api-client/
    │   ├── ui/
    │   └── config/
    │
    ├── supabase/
    │
    ├── infrastructure/
    │
    ├── docs/
    │
    └── .github/

This structure is intentional.

Do not create additional applications or services without architectural justification.

---

# 4. APPLICATIONS

## 4.1 Web application

There is exactly ONE Next.js web application:

    apps/web

It contains the entire web platform, including:

- public website
- authentication
- authority workspaces
- control room
- institution/organisation workspace
- administration
- project management
- inspections
- reports
- monitoring interfaces
- other role-specific workspaces

Do NOT create separate applications for:

- dashboard
- admin
- project portal
- landing page
- control room
- authority portal

Different workspaces are application features/routes, not separate applications.

The web application must communicate with the backend through the defined API boundary.

Do not directly query the database from the web application.

---

# 5. INSPECTOR MOBILE APPLICATION

The inspector application is:

    apps/inspector-mobile

Technology:

- React Native
- Expo
- TypeScript
- Expo Router
- SQLite for local/offline state

The mobile application communicates with Netram through API contracts.

It must never directly access PostgreSQL, Supabase database tables, or Drizzle.

Offline capability is mandatory for inspection workflows where required.

Offline operations must be:

- operation-based
- locally queued
- identified with client-generated operation IDs
- idempotent
- validated by the server
- reconciled against current server state

The server remains authoritative.

Offline mode does NOT bypass:

- authorization
- jurisdiction
- workflow rules
- state-transition rules
- evidence integrity requirements

Never implement last-write-wins synchronization for authoritative inspection state.

Rejected or conflicting operations must remain traceable.

---

# 6. CORE BACKEND

The primary backend is:

    services/api

It is a modular monolith.

The API owns core application and domain behavior including, where applicable:

- authentication context
- authorization
- users
- roles
- permissions
- role assignments
- authorities
- jurisdictions
- organisations
- programmes
- projects
- inspections
- inspection teams
- assignments
- findings
- corrective actions
- complaints
- evidence metadata
- reports
- audit
- notifications
- workflows
- risk/anomaly integration
- domain/application events

Do not split these into separate microservices without a demonstrated technical requirement.

---

# 7. SERVICE BOUNDARIES

Specialized services exist only for concerns that justify separation.

## AI

    services/ai

Responsible for:

- model inference
- anomaly detection
- frame processing
- attendance estimation
- AI scoring
- confidence
- model metadata
- AI-generated events/results

AI is advisory.

AI must NEVER:

- declare fraud as fact
- make irreversible administrative decisions
- modify official truth
- directly suspend projects
- directly issue notices
- bypass authority workflows

AI results must be represented as reviewable information.

---

## CCTV Gateway

    services/cctv-gateway

Responsible for:

- CCTV integration
- stream acquisition
- provider/protocol abstraction
- stream health
- authorized stream delivery
- integration with processing pipelines

Browsers and mobile clients must NOT receive raw RTSP credentials.

The application must not depend directly on a particular CCTV vendor or protocol.

---

## Realtime

    services/realtime

Responsible for event delivery.

Realtime is NOT the source of truth.

The authoritative state lives in the application/database.

Clients must be able to recover from:

- disconnects
- missed events
- reconnects
- duplicated events
- delayed events

by resynchronizing against the API.

---

# 8. DATA FLOW

The standard application flow is:

    Web / Mobile
          ↓
    Typed API Client
          ↓
    REST API
          ↓
    Application / Domain Services
          ↓
    Repository Interfaces
          ↓
    Data Layer
          ↓
    PostgreSQL

This boundary is mandatory.

The presentation layer must not know where data is stored.

The application layer must not know how persistence is implemented.

The domain must not depend on Supabase, Drizzle, PostgreSQL client libraries,
or another database vendor.

---

# 9. DATA LAYER

The data layer is:

    packages/data

It owns:

- repository implementations
- database queries
- ORM usage
- row mapping
- transactions
- persistence-specific logic
- database-specific implementation details

Drizzle belongs here.

PostgreSQL drivers belong here.

Database-specific SQL belongs here unless there is a documented reason for
another infrastructure-level location.

The rest of the application interacts through repository interfaces.

## Forbidden

Never do any of the following outside the data layer:

- import Drizzle
- import PostgreSQL drivers
- create database clients
- execute SQL
- query Supabase tables directly
- access database transactions directly
- depend on database row structures

The application should be able to replace PostgreSQL persistence without rewriting
business logic.

---

# 10. SUPABASE

Supabase is an infrastructure/provider choice.

It is NOT the application's architectural identity.

The application must not become Supabase-shaped.

Supabase may provide:

- PostgreSQL
- authentication
- storage
- local development infrastructure
- other explicitly selected infrastructure capabilities

Provider-specific functionality must be isolated behind appropriate interfaces.

The core application must operate in terms of Netram concepts.

For example:

    AuthenticatedUser

is preferable to exposing:

    SupabaseUser

through the entire application.

---

# 11. DATABASE

PostgreSQL is the architectural database technology.

Development uses a local database.

Production uses its own production database.

Environments must never accidentally share:

- credentials
- databases
- production data
- storage
- secrets

Local development must be reproducible.

The database lifecycle is:

    migration
        ↓
    reset
        ↓
    migration from zero
        ↓
    deterministic seed
        ↓
    application verification

Migrations are the source of truth.

Never manually modify a local database and assume that modification represents
the repository schema.

---

# 12. DATABASE RESET RULE

When schema changes are made during development:

1. Update migration/schema source.
2. Reset the LOCAL database.
3. Apply all migrations from zero.
4. Seed deterministic development data.
5. Start relevant services.
6. Verify the application against the new database.

NEVER reset production.

NEVER use destructive database commands against production.

The objective is that another developer can clone the repository and reproduce
the same database state.

---

# 13. SEED DATA

Development seed data must be:

- deterministic
- synthetic
- coherent
- interconnected
- safe
- reproducible

Seed data should demonstrate the actual architecture.

Where applicable, it should include examples involving:

- multiple states/districts
- authorities
- jurisdictions
- organisations
- projects
- programmes
- staff
- inspectors
- inspection teams
- inspections
- findings
- corrective actions
- complaints
- CCTV
- AI anomalies
- audit events
- outbox events

Never use real personal information.

Never commit real credentials.

Never create production seed accounts.

---

# 14. DOMAIN MODEL RULES

Domain concepts must remain separate.

Do not collapse unrelated concepts merely because they currently contain similar
fields.

Important distinctions include:

    User
    Role
    Permission
    RoleAssignment
    Authority
    Jurisdiction
    Organisation
    Programme
    Project
    InspectionTeam
    Inspector
    Inspection
    Finding
    CorrectiveAction
    Complaint
    Evidence
    Report
    AIAnomaly
    AuditEvent
    DomainEvent

Each represents a distinct responsibility.

---

# 15. AUTHENTICATION

Authentication is provider-agnostic.

Use an application-level authentication interface.

The application should operate on Netram authentication concepts rather than
provider-specific sessions.

The authentication layer must support future replacement of the initial provider.

Development authentication shortcuts must never accidentally become production
authentication mechanisms.

Authentication answers:

    "Who is this user?"

Authorization answers:

    "What is this user allowed to do here?"

Do not combine these concepts.

---

# 16. AUTHORIZATION

Authorization is server-side and mandatory.

Use:

    Role
    Permission
    RoleAssignment
    Authority
    Jurisdiction
    Scope
    Policy

as distinct concepts.

Users may have multiple role assignments.

A role assignment may have:

- authority
- jurisdiction
- scope
- permissions
- applicable policy

Do not hard-code authorization around a small fixed list such as:

    GLOBAL
    STATE
    DISTRICT
    ORGANIZATION

unless those are represented as extensible jurisdiction concepts rather than
the entire authorization model.

The authorization system must be extensible.

The client may hide UI controls for usability.

The server must independently enforce the same authorization decision.

---

# 17. JURISDICTION

Jurisdiction is a first-class access-control primitive.

Do not scatter jurisdiction checks throughout controllers.

Authorization policy should be centralized and reusable.

A user may have authority in one jurisdiction while lacking authority in another.

Never assume:

    user role = complete authorization decision

The authorization decision depends on the relevant:

- identity
- permission
- role assignment
- authority
- jurisdiction
- resource
- operation
- policy

---

# 18. API

The primary application API is:

    REST / JSON

under:

    /api/v1/

Use explicit, predictable resource-oriented endpoints.

Do not introduce GraphQL, gRPC, or another API protocol without a demonstrated
architectural requirement.

API responses must use stable contracts.

Standard error shape:

    {
      "error": {
        "code": "...",
        "message": "...",
        "requestId": "...",
        "details": {}
      }
    }

Do not expose internal stack traces, SQL errors, provider errors, or secrets
through public API responses.

---

# 19. API CONTRACTS

OpenAPI is the canonical HTTP API contract.

Shared TypeScript types and generated/typed clients must remain aligned with
the API contract.

Runtime input validation is mandatory.

Use the shared validation package where appropriate.

Do not let frontend types silently diverge from backend contracts.

When changing an API:

1. update the contract
2. update validation
3. update backend implementation
4. update client
5. update tests
6. verify consumers

---

# 20. SHARED PACKAGES

Shared packages must remain focused.

## `packages/types`

Shared domain and contract types.

## `packages/validation`

Runtime validation schemas.

## `packages/api-client`

Typed API communication.

## `packages/data`

Persistence and repositories.

## `packages/ui`

Reusable presentation components.

## `packages/config`

Centralized validated configuration.

Do not turn shared packages into junk drawers.

A shared package should exist because multiple consumers genuinely need the
abstraction.

Do not move code into shared packages merely to make imports look cleaner.

---

# 21. CONFIGURATION

Configuration is centralized and validated.

Do not scatter:

    process.env.X

throughout the codebase.

Environment configuration should be:

- centralized
- typed
- validated
- documented
- environment-specific

Every new environment variable must:

1. be added to the configuration schema
2. be documented in `.env.example`
3. specify whether it is server-only
4. have a clear purpose

Secrets must never be exposed to client-side code.

Never use public environment-variable prefixes for secrets.

---

# 22. SECRET MANAGEMENT

Never commit:

- `.env`
- `.env.local`
- production credentials
- API keys
- private keys
- database passwords
- service-role credentials
- access tokens

Use `.env.example` for documentation.

Never place secrets in:

- source code
- seed data
- tests
- screenshots
- logs
- documentation
- client bundles

If a secret appears in repository history, treat it as compromised and notify
the repository owner.

---

# 23. FEATURE FLAGS

Feature flags are separate from configuration.

Use feature flags for controlled application behavior.

Do not use feature flags as a substitute for:

- authorization
- security controls
- data validation
- business policy
- environment configuration

Feature flags should remain lightweight unless the requirements genuinely demand
a larger feature-management system.

---

# 24. BUSINESS LOGIC

Business logic belongs in application/domain services.

UI components must not contain business rules.

Controllers/routes must coordinate requests, not become giant business-logic
files.

Repositories must persist data, not decide business policy.

A useful boundary is:

    Controller
        → validates request / establishes context
        → calls application service

    Application Service
        → authorization
        → business workflow
        → domain decisions
        → repository operations
        → domain events

    Repository
        → persistence

Do not implement business decisions inside React components.

---

# 25. TRANSACTIONS

Use database transactions when multiple persistence changes must represent one
atomic business operation.

Important operations such as:

    state change
    +
    audit record
    +
    outbox event

must be atomic where required by the domain.

Do not rely on eventually consistent side effects when the requirement is
transactional correctness.

---

# 26. EVENTS

Domain/application events are first-class concepts.

Examples include:

- `InspectionAssigned`
- `InspectionStarted`
- `InspectionSubmitted`
- `EvidenceCaptured`
- `EvidenceUploaded`
- `EvidenceIntegrityFailed`
- `ComplaintSubmitted`
- `CorrectiveActionOverdue`
- `AIAnomalyDetected`
- `ProjectSuspended`

Events must not expose unnecessary sensitive information.

Important durable events should use the outbox pattern.

The outbox exists so that:

    application state
    +
    event publication intent

cannot silently diverge.

---

# 27. OUTBOX

The outbox must be durable.

Where required:

    database transaction
        ├── business state mutation
        └── outbox event

A worker can then publish/process the outbox event.

Outbox processing must account for:

- retries
- duplicate delivery
- idempotency
- failure states
- observability

Do not assume an event is delivered exactly once.

Consumers must be designed to tolerate duplicate processing where applicable.

---

# 28. REALTIME

Realtime is delivery, not truth.

WebSocket/SSE messages should communicate that something changed.

Clients must not treat a realtime message as permanent authoritative state.

After:

- reconnect
- missed messages
- application resume
- synchronization failure

the client should resynchronize from the authoritative API.

Do not store important business truth only in a realtime service.

---

# 29. BACKGROUND JOBS

Heavy or asynchronous work must not unnecessarily block HTTP requests.

Use the job system for appropriate workloads such as:

- report generation
- media processing
- AI processing
- notifications
- evidence processing
- asynchronous integrations
- scheduled work

Jobs must be:

- retryable
- observable
- idempotent where appropriate
- capable of representing failure

Never silently swallow failed jobs.

---

# 30. EVIDENCE

Inspection evidence is authoritative operational data.

Evidence metadata must include appropriate information such as:

- evidence ID
- inspection ID
- capture time
- location
- evidence type
- file metadata
- content hash
- device/session metadata

Large media belongs in object storage.

The database stores metadata and references.

Evidence integrity must be checked server-side.

Capture-time hashing and upload-time verification must be supported where
specified by the architecture.

A hash demonstrates byte equality with the previously hashed content.

It does NOT prove that the evidence itself represents truthful events.

Do not make claims stronger than the integrity mechanism actually supports.

---

# 31. OFFLINE INSPECTIONS

Offline inspection support must be designed around operations.

Do not build an offline system that merely queues files.

Each operation should have a client-generated idempotency/operation identifier.

The server must:

1. authenticate the request
2. authorize it
3. validate the operation
4. compare against current state
5. accept, reject, or flag conflict
6. preserve the result for traceability

The server is authoritative.

Never resolve authoritative workflow conflicts through blind last-write-wins.

---

# 32. INSPECTION WORKFLOW

Inspection workflows must preserve separation between:

    inspector observation
            ↓
    findings
            ↓
    authority review
            ↓
    decision
            ↓
    corrective action
            ↓
    verification
            ↓
    closure

Inspectors do not become administrative decision-makers merely because they
capture evidence.

Do not allow the mobile application to directly perform authority-level
decisions.

---

# 33. PROJECT LIFECYCLE

Project lifecycle transitions must be explicit, authorized, and audited.

Expected lifecycle includes:

    Draft
      ↓
    Pending Verification
      ↓
    Approved
      ↓
    Active
      ↓
    Suspended ↔ Active
      ↓
    Closed
      ↓
    Archived

Do not allow arbitrary state mutation.

Invalid transitions must be rejected.

Historical records must remain traceable.

---

# 34. DISCLOSURE AND INFORMATION VISIBILITY

Information disclosure is policy-driven.

Do not merely send sensitive information to the client with:

    visible: false

and expect the UI to hide it.

If a user is not authorized to receive a field:

    DO NOT SEND THE FIELD.

The API must omit undisclosed information entirely.

Disclosure policies may depend on:

- authority
- inspection state
- timing
- assignment
- geofence
- manual authorization
- configured policy

---

# 35. COMPLAINTS

Complaints are oversight inputs.

They are not automatically equivalent to:

    confirmed misconduct
    confirmed fraud
    automatic inspection

A complaint may lead to:

- review
- request for explanation
- notice
- inspection
- escalation
- no action
- resolution

The system must preserve that distinction.

---

# 36. AI

AI is an informer, not an authority.

AI outputs should represent concepts such as:

- anomaly score
- severity
- confidence
- supporting evidence
- explanation
- model version

AI results must remain reviewable.

AI lifecycle may include:

    New
    Reviewed
    Dismissed
    Investigated
    Acted Upon

Never encode:

    AI detected anomaly
        =
    organization is guilty

That would be both bad engineering and an impressively efficient way to create
a government scandal.

---

# 37. AUDIT LOGGING

Audit logging is cross-cutting and mandatory.

Audit records should capture relevant:

- administrative actions
- authorization-sensitive actions
- state transitions
- evidence events
- security events
- workflow decisions
- configuration changes
- important system events

Audit records are append-oriented.

Normal application workflows must not allow users to silently edit or delete
historical audit records.

Audit generation belongs to the application/domain layer.

The frontend must never be responsible for deciding:

    "this action should be audited"

---

# 38. AUDIT VS OPERATIONAL LOGGING

These are different systems.

Operational logs answer:

    "What happened inside the software?"

Audit logs answer:

    "What significant action happened in the system and who/what caused it?"

Do not use application debug logs as an audit trail.

Do not put sensitive personal information into operational logs unnecessarily.

---

# 39. PRIVACY

Follow:

- data minimization
- least privilege
- encryption in transit
- encryption at rest where applicable
- controlled access
- appropriate retention
- privacy-aware logging

Do not put unnecessary PII into:

- logs
- AI prompts
- AI results
- realtime events
- analytics
- error messages

Retention and deletion policies must be configurable where required by the
programme/legal context.

---

# 40. LOCATION

Live location is permitted only where required for active inspection workflows
and according to authorization/policy.

Location access must be:

- permission-controlled
- purpose-limited
- audited where appropriate

Geofencing is a supporting control.

It is NOT absolute proof of misconduct.

Do not encode:

    outside geofence = fraud

---

# 41. NOTIFICATIONS

Notifications are event-driven and provider-agnostic.

Supported channels may include:

- in-app
- push
- email
- SMS

Business logic should emit an application/domain event.

Business logic should NOT directly call:

    Twilio
    Firebase
    email vendor
    SMS provider
    etc.

Provider integrations belong behind adapters/interfaces.

Push notifications should contain minimal sensitive information.

The application should fetch authoritative details after opening.

---

# 42. CCTV

CCTV integration must use a provider/protocol abstraction.

The browser/mobile client must not directly receive camera credentials.

Expected architecture:

    Camera / NVR
        ↓
    CCTV Gateway
        ↓
    Authorized Stream
        ↓
    Control Room / Processing
        ↓
    AI / Alerts
        ↓
    Application

Netram does not need to become a full NVR platform unless explicitly required.

---

# 43. VIDEO CONFERENCING

Video conferencing must be provider-agnostic.

Netram owns:

- session lifecycle
- participant authorization
- session context
- tokens/access
- audit
- association with relevant workflow

The actual media transport may be handled by WebRTC or an approved external
provider.

Do not implement a custom video protocol merely because humans enjoy rebuilding
things that already work.

---

# 44. UI ENGINEERING

Next.js Server Components are the default.

Use Client Components only when required for:

- interaction
- hooks
- browser APIs
- realtime UI
- local state
- other client-only behavior

Do not put business logic in UI components.

Do not directly query databases from UI.

Do not import backend-only modules into client components.

---

# 45. UI PACKAGE

Reusable UI primitives may live in:

    packages/ui

Do not move page-specific business behavior into the UI package.

UI components should remain presentation-oriented.

---

# 46. IMAGES AND ASSETS

Use `next/image` appropriately in the web application.

Remote image sources must be explicitly configured.

Do not disable image optimization without a legitimate reason.

Do not introduce random image-hosting dependencies.

---

# 47. API CLIENT

Web and mobile should use the typed API client where appropriate.

The API client is responsible for:

- request construction
- typed responses
- API error handling
- authentication transport
- contract consistency

The API client must not contain database logic.

---

# 48. TESTING

Testing must exist at multiple levels.

## Unit tests

Test isolated:

- domain logic
- authorization policies
- assignment algorithms
- validation
- utility behavior

## Integration tests

Test:

- repositories
- database interactions
- transactions
- API/application workflows
- authorization against realistic data

## Contract tests

Verify API implementation against OpenAPI contracts.

## E2E tests

Test critical user workflows.

## Mobile tests

Test critical offline/synchronization behavior.

## AI tests

Test deterministic model/service behavior and anomaly processing logic.

Tests must verify behavior, not merely inflate coverage statistics.

---

# 49. CRITICAL WORKFLOW TESTING

At minimum, critical workflows should cover the architecture's major boundaries.

Examples:

    authenticated user
        ↓
    authorization
        ↓
    API
        ↓
    application service
        ↓
    repository
        ↓
    database
        ↓
    audit
        ↓
    outbox
        ↓
    realtime

Tests should verify failure paths as well as successful paths.

Especially test:

- unauthorized access
- wrong jurisdiction
- invalid lifecycle transition
- duplicate operation
- conflicting offline operation
- evidence integrity failure
- failed job
- duplicate event
- missing resource
- hidden/disclosed information

---

# 50. TOOLING

The repository uses:

- pnpm
- pnpm workspaces
- Turborepo
- TypeScript
- Next.js
- React
- React Native
- Expo
- Fastify
- Drizzle
- PostgreSQL
- Zod
- OpenAPI
- Vitest
- Playwright
- pytest
- Docker / Docker Compose

Use the versions declared by the repository.

Do not introduce npm, yarn, or bun package management.

The repository should have one authoritative lockfile.

Do not add competing package-manager lockfiles.

---

# 51. TYPESCRIPT

Use strict TypeScript.

Avoid `any`.

If `any` is genuinely necessary:

- document why
- keep it localized
- do not allow it to spread

Prefer:

- explicit types
- discriminated unions
- typed errors
- typed API contracts
- runtime validation at boundaries

Do not assume TypeScript types provide runtime validation.

---

# 52. VALIDATION

Validate untrusted input at boundaries.

Examples:

- API requests
- query parameters
- environment variables
- external provider responses
- uploaded metadata
- mobile synchronization operations

Use Zod or the repository's approved validation mechanism.

Never trust client-provided authorization claims.

---

# 53. ERROR HANDLING

Errors must be explicit and observable.

Do not silently swallow errors.

Do not expose:

- stack traces
- database errors
- credentials
- internal service details

to users.

Use stable application error codes where appropriate.

Every request should have a correlation/request identifier.

---

# 54. OBSERVABILITY

The system should support:

- structured logging
- request/correlation IDs
- metrics
- health checks
- error tracking
- background job monitoring
- CCTV health monitoring
- AI processing monitoring
- storage/upload monitoring
- notification monitoring

OpenTelemetry should be used where defined by the architecture.

Operational observability must not become a source of sensitive data leakage.

---

# 55. ENVIRONMENTS

Maintain clear environment separation:

    development
    CI/test
    demo/staging
    production

Each environment must have independent:

- database
- credentials
- secrets
- storage
- configuration
- external integrations

Never use production credentials for development or tests.

Never use production data as seed data.

---

# 56. DOCKER AND LOCAL DEVELOPMENT

The repository should be container-friendly.

Local development infrastructure should be reproducible.

Docker Compose may provide local dependencies such as:

- PostgreSQL
- Redis
- MinIO
- other required infrastructure

Do not require Kubernetes for local development unless explicitly justified.

The goal is that a developer can reproduce the system without manually assembling
a zoo of infrastructure.

---

# 57. DEVELOPMENT WORKFLOW

Before implementing a task:

1. Read this `AGENTS.md`.
2. Read the relevant architectural context in `docs/`.
3. Inspect the relevant existing implementation.
4. Identify affected boundaries.
5. Check existing contracts/types/interfaces.
6. Determine whether the task requires an architectural decision.
7. Implement the smallest correct change.
8. Run appropriate verification.
9. Review the resulting diff.
10. Report what changed and what was verified.

Do not blindly start editing files.

---

# 58. EXISTING CODE

Existing code must be classified before substantial refactoring:

    KEEP
    ADAPT
    MOVE
    REMOVE
    REBUILD

Use existing code when it genuinely fits the new architecture.

Do not preserve legacy architecture for emotional reasons.

Code being old is not itself a reason to keep it.

Code being new is not itself a reason to trust it.

---

# 59. ARCHITECTURE CHANGES

Significant architecture changes require an ADR in:

    docs/decisions/

An ADR should explain:

- context
- problem
- decision
- alternatives considered
- consequences

Do not introduce a major architectural change through an unexplained helper
file and hope nobody notices.

---

# 60. DOCUMENTATION

Important architecture and contracts are first-class repository artifacts.

Relevant documentation includes:

    docs/
    ├── architecture/
    ├── domain/
    ├── contracts/
    ├── decisions/
    ├── development/
    └── OWNERSHIP.md

Documentation must describe the current architecture.

Do not document obsolete behavior as though it were current.

---

# 61. OWNERSHIP

Ownership is defined in:

    docs/OWNERSHIP.md

and enforced/reinforced through:

    .github/CODEOWNERS

Ownership means review responsibility and architectural accountability.

It does NOT mean that other contributors are forbidden from touching an area.

Cross-boundary changes should involve the appropriate owners.

---

# 62. CODEOWNERS

CODEOWNERS should reflect the current team ownership model.

At minimum, ownership should distinguish:

- web
- mobile
- core API
- AI
- CCTV
- realtime
- data
- shared contracts/types
- validation
- infrastructure

Do not invent GitHub usernames.

Use placeholders where the real GitHub identity is not yet known.

CODEOWNERS must not become an excuse to block ordinary collaboration.

---

# 63. CROSS-SERVICE DEPENDENCIES

Services communicate through explicit contracts.

Do not import source code directly from another service.

Forbidden:

    services/api imports source from services/ai
    services/ai imports source from services/api
    services/cctv-gateway imports internal API modules
    services/realtime imports API internals

Allowed mechanisms include:

- HTTP APIs
- typed contracts
- event contracts
- message/job contracts
- explicitly shared packages

Shared packages must not become a backdoor for sharing private service
implementation details.

---

# 64. NO VENDOR LEAKAGE

Vendor-specific code belongs at integration boundaries.

Do not allow:

    Supabase types
    Firebase types
    Twilio types
    specific CCTV SDK types
    specific VC provider types
    cloud-provider SDK types

to become core domain concepts.

Use adapters/interfaces.

The core application should speak Netram's language.

---

# 65. SECURITY

Security is a system property, not a frontend feature.

Always consider:

- authentication
- authorization
- jurisdiction
- input validation
- secrets
- privilege escalation
- information disclosure
- auditability
- file upload security
- object storage access
- replay/idempotency
- offline synchronization
- service authentication
- provider credentials

Never rely on the client for security.

---

# 66. ARCHITECTURE GUARDS

The repository should mechanically check important architectural rules.

Architecture checks should detect violations such as:

- database access outside `packages/data`
- Drizzle imports outside the data layer
- direct database clients outside the data layer
- cross-service source imports
- secret leakage
- competing package managers
- invalid dependency directions
- other explicitly defined architecture violations

If an architecture rule changes, update the guard and documentation together.

---

# 67. DEPENDENCY DIRECTION

Dependencies should flow toward abstractions.

A simplified rule:

    UI
      ↓
    API Client / UI contracts
      ↓
    API
      ↓
    Application / Domain
      ↓
    Repository Interfaces
      ↓
    Data Implementation
      ↓
    PostgreSQL

Provider adapters sit at infrastructure boundaries.

Do not invert this by allowing low-level infrastructure to dictate domain design.

---

# 68. GIT BRANCHING AND INTEGRATION POLICY

Netram uses a controlled promotion pipeline:

    production
        ↓
    preview
        ↓
    develop
        ↓
    feature/*

This policy is authoritative for Git branching behavior in the Netram repository.
When existing repository instructions conflict with this policy, this policy is
the intended branching model. Do not preserve legacy branching behavior merely
because it exists in older documentation or scripts.

## 68.1 Branch roles

* `production`

  The only permanent branch. Represents the current production-ready state.
  Must never receive direct development commits.

* `preview`

  Temporary release-candidate branch. Created from the latest `production`.
  Exists only for the current release/development cycle. Deleted after it is
  successfully squash-merged into `production`.

* `develop`

  Temporary integration branch for the current release/development cycle.
  Created from the current `preview`. Feature branches are created from
  `develop`. Deleted after it is successfully squash-merged into `preview`.

* `feature/*`

  Temporary work branches. Created from the current `develop`. Multiple feature
  branches may exist simultaneously. Deleted after successful integration into
  `develop`.

The repository has exactly one permanent branch: `production`. All other
branches are temporary.

## 68.2 Branch creation hierarchy

    production
        ↓
    preview
        ↓
    develop
        ↓
    feature/*

- `preview` MUST be created from the latest `production`.
- `develop` MUST be created from the current `preview`.
- `feature/*` MUST be created from the current `develop`.
- Never create a feature branch directly from `production` or `preview`.
- Never create `develop` directly from `production`.
- Never create `preview` from `develop`.

Never bypass an integration level.

## 68.3 Promotion and merge direction

Changes move toward production in exactly this direction:

    feature/* → develop
    develop → preview
    preview → production

These are the only normal promotion paths. The following are prohibited:

    feature/* → preview
    feature/* → production
    develop → production
    preview → develop
    production → develop
    production → preview
    unrelated-feature → unrelated-feature

A branch MUST NOT skip an integration stage.

## 68.4 Pull Request requirement

Every promotion MUST happen through a Pull Request. Direct pushes to
`production`, `preview`, and `develop` are prohibited.

    feature/* → develop      PR + Squash and Merge
    develop → preview        PR + Squash and Merge
    preview → production     PR + Squash and Merge

Never bypass the Pull Request process simply because a change is small.

## 68.5 Squash and merge

All normal Pull Requests MUST use Squash and Merge, at every stage:

    feature/* → develop
    develop → preview
    preview → production

Feature branches may contain as many commits as necessary during development.
The target branch receives one logical squashed commit representing the
completed unit of work. Do not require artificially clean commit history on
feature branches.

## 68.6 Source branch deletion

After every successful Pull Request + Squash and Merge, the source branch MUST
be deleted, at every stage:

    feature/cctv → develop      →  feature/cctv is deleted
    develop → preview           →  develop is deleted
    preview → production        →  preview is deleted

The target branch always survives the merge. The source branch is temporary
and is removed after successful integration.

## 68.7 Branch lifecycle

    production
        ↓
    create preview from production
        ↓
    create develop from preview
        ↓
    create feature branches from develop
        ↓
    feature branches are developed independently
        ↓
    feature/* → develop  (feature branches deleted)
        ↓
    develop → preview    (develop deleted)
        ↓
    preview → production (preview deleted)
        ↓
    production

When the next development cycle begins, create a new `preview` from
`production`, a new `develop` from `preview`, and new feature branches from
`develop`. Do not keep stale `preview` or `develop` branches between release
cycles.

## 68.8 Feature branch independence

Multiple feature branches may exist simultaneously. Feature branches are
independent by default. One feature branch MUST NOT be merged into another
unrelated feature branch. If a feature genuinely depends on another feature,
that dependency must be explicit. A feature branch may contain multiple commits
and may perform internal merges if technically necessary. The final integration
into `develop` MUST happen through `feature/* → develop` using a Pull Request
and Squash and Merge.

## 68.9 Child feature branches

A feature branch may create temporary child branches only for genuine parallel
work on the same feature (for example `feature/cctv` → `feature/cctv-ui`). A
child branch must ultimately merge back into its parent feature branch. Only
the top-level feature branch should normally be promoted into `develop`. Avoid
unnecessary or deeply nested feature branch hierarchies. Do not create child
branches merely to split ordinary implementation work.

## 68.10 Feature branch continuity rule

Complete an entire feature scope on one branch. For example, if the current
branch is `feature/cctv-streaming`, continue working there for further
CCTV-streaming changes. Do NOT automatically create
`feature/cctv-snapshot-fix`, `feature/cctv-api-update`, or similar unless the
user explicitly instructs you to create a new branch. Do not create a new
branch because:

- another file needs modification
- another commit is required
- a bug is discovered within the same feature
- the feature becomes larger than expected
- the implementation needs refactoring
- the agent thinks another branch would be cleaner
- `develop` has received unrelated changes

Default behavior:

    STAY ON THE CURRENT FEATURE BRANCH.

Create a new branch only when explicitly requested by the user, or when the
current work is clearly a separate, independently deliverable task and the user
has authorized splitting the work.

## 68.11 Agent branch verification

Before modifying code, an AI agent MUST determine the current Git state:

    git branch --show-current
    git status

Refresh remote state when appropriate:

    git fetch --prune

The agent must know: which branch it is currently on; whether there are
uncommitted changes; whether the current branch is appropriate for the
requested work; which branch the work should eventually merge into; whether the
requested merge direction follows this policy. The agent MUST NOT silently
switch branches.

## 68.12 Uncommitted work protection

Never discard uncommitted user work. Before switching branches, rebasing,
merging, resetting, cleaning, or deleting a branch, inspect the working tree.
Do not use destructive commands (`git reset --hard`, `git clean -fd`) unless
explicitly authorized and the affected work is confirmed disposable. If
uncommitted work belongs to the current feature, continue on the current
feature branch.

## 68.13 Updating a feature branch from develop

`develop` may change while a feature branch is being developed. Do NOT
automatically merge or rebase `develop` into the feature branch every time
`develop` changes. Update the feature branch only when technically necessary:
resolving conflicts, incorporating required changes, ensuring compatibility,
or testing against the latest integration state. Prefer a normal merge over a
rebase unless there is a specific reason. Do not rewrite history on a shared
branch without explicit coordination.

## 68.14 Branch deletion safety

A branch MUST NOT be deleted before its Pull Request has been successfully
merged. After a Pull Request is merged:

1. Verify that the merge completed successfully.
2. Confirm that the target branch contains the expected changes.
3. Delete the remote source branch.
4. Prune stale remote-tracking references.
5. Delete the corresponding local source branch.

Never delete an active or unmerged feature branch. Never assume a branch was
merged without verification.

## 68.15 Remote branch cleanup

GitHub should automatically delete the source branch after a Pull Request is
successfully merged. Developers and agents must still verify that the remote
branch is gone:

    git fetch --prune

Do not assume local Git state automatically reflects remote branch deletion.

## 68.16 Local branch cleanup

Remote branch deletion does not necessarily delete the local branch. Clean up
the local source branch after successful integration:

    git fetch --prune
    git branch -d <merged-branch>

Use `git branch -d` for normal cleanup. Do NOT routinely use `git branch -D`;
forced deletion can destroy unmerged work.

## 68.17 Force push policy

Force pushes are prohibited on `production`, `preview`, and `develop`. If a
force push is genuinely required on a private feature branch, prefer:

    git push --force-with-lease

over `git push --force`. A feature branch may only be force-pushed when it is
not being relied upon by another developer or agent and the operation will not
destroy another person's work. Force pushing is never a normal solution to
merge conflicts.

## 68.18 Branch naming

Feature branches MUST use:

    feature/<short-description>

Lowercase with hyphens:

    feature/cctv-streaming
    feature/attendance-sync
    feature/admin-dashboard
    feature/evidence-upload

Avoid vague names (`feature/test`, `feature/temp`, `feature/new`,
`feature/fix`, `feature/stuff`). The branch name should describe the work, not
the person performing it.

## 68.19 Bug fixes

A bug discovered while implementing the current feature belongs to the current
feature branch if it is part of that feature's scope. Do not create another
branch simply because the change is technically a bug fix. For an independent
bug unrelated to the current feature, create a separate branch from the current
`develop` only when the user explicitly requests or authorizes separate work.
Do not invent additional branch categories (`bugfix/*`, `hotfix/*`,
`refactor/*`) unless this policy is explicitly updated. For now, all temporary
work branches use `feature/*`.

## 68.20 Production changes

Never modify `production` directly. The normal production promotion path is
always:

    feature/* → develop → preview → production

No agent may bypass `develop` or `preview` to get a change into production. If
an emergency production fix is required, do not invent an alternative Git
workflow. Stop and request explicit direction unless a dedicated hotfix policy
has been defined in this repository.

## 68.21 Repository invariants

1. `production` is the only permanent branch.
2. `preview` is temporary and belongs to the current release cycle.
3. `develop` is temporary and belongs to the current release cycle.
4. Feature branches are temporary.
5. `preview` is created from `production`.
6. `develop` is created from `preview`.
7. Feature branches are created from `develop`.
8. All normal integration happens through Pull Requests.
9. All normal Pull Requests use Squash and Merge.
10. Promotion happens only in this direction:
    `feature/* → develop → preview → production`.
11. After successful integration, the source branch is deleted.
12. Remote merged branches are automatically deleted where GitHub supports it.
13. Local merged branches must be cleaned up by the developer or agent.
14. Agents must remain on their current feature branch unless explicitly
    instructed otherwise.
15. Agents must never silently create, switch, delete, reset, or rewrite
    branches.
16. No direct development commits are made to `production`, `preview`, or
    `develop`.
17. No integration stage may be skipped.
18. Uncommitted user work must never be discarded.

## 68.22 Expected repository topology

During active development, the repository should look like:

    production
        │
        └── preview
              │
              └── develop
                    ├── feature/cctv
                    ├── feature/attendance
                    ├── feature/reports
                    └── feature/dashboard

After all features are integrated:

    production → preview → develop

After `develop → preview`:

    production → preview

After `preview → production`:

    production

The next cycle starts again from the latest `production`.

## 68.23 Agent decision rules

When an agent receives a development request, follow this decision process:

- **Case 1** — Already on an appropriate feature branch: continue on the
  current branch. Do not create a new branch.
- **Case 2** — On `develop` and the user requests a new feature: create a new
  feature branch from the latest `develop`.
- **Case 3** — On `production`, `preview`, or another inappropriate branch: do
  not begin feature development there. Determine the correct feature branch
  workflow before modifying code.
- **Case 4** — User explicitly requests a new branch: follow the user's
  explicit branch instruction, provided it does not violate this policy.
- **Case 5** — User asks to merge work: verify the current and target branches.
  Confirm the merge direction is `feature/* → develop`, `develop → preview`, or
  `preview → production`. Then use a Pull Request and Squash and Merge.
- **Case 6** — A branch has already been merged: do not continue working on it.
  Prune remote references and delete the local merged branch.

---

# 69. COMMIT AND PUSH AUTHORIZATION

AI agents must NOT:

- commit
- push
- merge
- open pull requests

unless explicitly instructed by the repository owner.

Normal agent workflow is:

    modify
    ↓
    verify
    ↓
    report

Only perform Git write operations when explicitly requested.

Never add:

- `Co-Authored-By`
- `Co-authored-by`
- `Signed-off-by`
- agent attribution
- bot attribution
- "Generated by" attribution

to commits.

---

# 70. NON-DESTRUCTIVE WORKING RULE

Never destroy existing user work.

Do not use destructive commands such as:

    git reset
    git clean
    git restore
    git checkout -- <file>

to discard changes unless explicitly instructed.

If uncommitted changes exist:

- inspect them
- determine whether they are relevant
- preserve them
- work around them where possible

Never assume uncommitted work is disposable.

---

# 71. DATABASE DESTRUCTIVE OPERATIONS

Database resets are allowed ONLY for local development/test databases.

Never run destructive database operations against production.

Before running a reset:

    verify the target environment.

If there is any ambiguity about whether a database is production:

    STOP.

Do not guess.

---

# 72. DEV SERVERS

Do not blindly kill running development servers.

Before restarting a service:

1. determine whether it is currently running
2. determine whether the task actually requires a restart
3. preserve the user's running environment where possible

If a code change can be picked up through hot reload, prefer that.

If a restart is required because configuration/dependencies changed, restart only
the affected service and verify it afterwards.

Do not kill unrelated processes.

---

# 73. COMMAND SAFETY

Before executing a potentially destructive command, verify:

- target path
- environment
- service
- database
- branch
- scope of impact

Never run commands based on assumptions.

Especially verify commands involving:

- databases
- Docker volumes
- filesystem deletion
- Git history
- credentials
- production infrastructure

---

# 74. COMPLETION STANDARD

A task is NOT complete merely because files were created.

A task is complete when:

- implementation matches the architecture
- contracts are updated
- relevant tests pass
- typechecking passes
- linting passes
- builds pass where applicable
- architecture checks pass
- database changes are reproducible
- relevant runtime behavior has been verified
- no obvious boundary violations remain

Do not claim a task is verified unless it was actually verified.

---

# 75. VERIFICATION COMMANDS

Use the repository's current pnpm scripts.

Typical checks include:

    pnpm lint
    pnpm typecheck
    pnpm test
    pnpm build

Database verification should include the repository's database scripts, such as:

    db:reset
    db:migrate
    db:seed
    db:setup

Use the actual scripts defined by the repository.

Do not invent commands and claim they were run.

---

# 76. RUNTIME VERIFICATION

For changes involving the full application flow, static checks are insufficient.

Where applicable, verify:

    database
      ↓
    API
      ↓
    authorization
      ↓
    application service
      ↓
    repository
      ↓
    audit/outbox
      ↓
    realtime
      ↓
    client

For critical workflows, perform actual requests/actions rather than relying
only on compilation.

---

# 77. CHANGE REPORTING

When an agent finishes a task, report:

## Changed

What was actually changed.

## Architecture

Which architectural boundaries were affected.

## Verification

Exact checks actually executed and their result.

## Database

Whether migrations/reset/seed were run.

## Runtime

Which services were started/tested.

## Remaining

Known limitations, deferred work, or failures.

Never report:

    "all good"

when there are known failures.

Never hide failed tests or skipped verification.

---

# 78. DO NOT OVERBUILD

Do not implement hypothetical requirements simply because they might be useful
one day.

Examples:

- unnecessary microservices
- unnecessary abstraction layers
- unnecessary databases
- unnecessary message brokers
- unnecessary APIs
- speculative government integrations
- elaborate feature-flag systems
- generic frameworks inside the framework

Build the architecture required by Netram.

Leave deliberate extension points where the architecture requires them.

---

# 79. DO NOT UNDERBUILD

Likewise, do not remove required architecture simply because it makes the first
vertical slice slightly harder.

Do not omit:

- authorization
- audit
- outbox
- repository boundaries
- API contracts
- validation
- offline operation identity
- evidence integrity
- jurisdiction
- provider abstraction

from foundational implementations when they are part of the required design.

A vertical slice should demonstrate the real architecture, not a toy version that
will later need to be thrown away.

---

# 80. TERMINOLOGY

Use the terminology defined by the current Netram architecture.

Do not reintroduce obsolete terms into:

- code
- database
- APIs
- routes
- types
- documentation
- seed data
- UI
- comments

If a legacy term remains in the repository, treat it as migration debt.

Do not create new code using obsolete terminology.

---

# 81. AGENT BEHAVIOR

AI agents working in this repository must:

- inspect before editing
- understand boundaries before creating abstractions
- follow existing contracts
- prefer small coherent changes
- verify their work
- preserve user changes
- avoid destructive commands
- avoid speculative architecture
- never silently weaken security
- never bypass authorization
- never bypass the data layer
- never expose secrets
- never invent infrastructure requirements
- never claim verification that did not happen

When a task conflicts with the architecture, stop and identify the conflict
rather than quietly implementing an incompatible design.

---

# 82. HUMAN TEAM BEHAVIOR

The same architecture applies to human contributors.

Developers should:

- work within ownership boundaries
- use shared contracts
- avoid direct database access
- avoid vendor leakage
- document significant architectural decisions
- keep changes reviewable
- test boundary behavior
- communicate cross-service changes
- avoid modifying unrelated areas

Ownership is responsibility, not territorial ownership of code.

---

# 83. ARCHITECTURE REVIEW CHECKLIST

Before merging significant work, ask:

### Structure

- Is the code in the correct application/service/package?
- Did this introduce an unnecessary service?

### Data

- Is database access confined to the data layer?
- Is the repository interface respected?
- Is the schema reproducible?

### API

- Is the API contract updated?
- Is runtime validation present?
- Is authorization enforced server-side?

### Security

- Are secrets protected?
- Is sensitive information omitted rather than merely hidden?
- Is jurisdiction enforced?

### Domain

- Is business logic in the application/domain layer?
- Are domain concepts kept separate?
- Are workflow transitions valid and audited?

### Events

- Should this operation emit an event?
- Does it require the outbox?
- Is realtime being treated only as delivery?

### Offline

- Does this affect mobile synchronization?
- Is the operation idempotent?
- What happens during conflict?

### Testing

- Is the behavior tested?
- Are authorization failures tested?
- Are integration boundaries tested?

### Operations

- Is configuration documented?
- Is observability sufficient?
- Can another developer reproduce the environment?

---

# 84. FINAL PRINCIPLE

Netram must remain one coherent system.

The goal is NOT:

    "make the existing code work."

The goal is:

    "build Netram according to the current architecture."

Existing code is material to evaluate.

The new architecture is the destination.

When old implementation and new architecture disagree:

    REMOVE THE CONFLICT.

When a requirement can be satisfied simply:

    CHOOSE THE SIMPLE SOLUTION.

When a boundary protects correctness:

    KEEP THE BOUNDARY.

When something is transient:

    DO NOT TREAT IT AS AUTHORITATIVE.

When something is authoritative:

    MAKE IT DURABLE, AUDITABLE, AND SERVER-CONTROLLED.

When an agent is uncertain:

    READ THE CURRENT ARCHITECTURE MACRO BEFORE INVENTING A NEW DESIGN.

The repository should remain understandable to a new developer who has never seen
the old architecture.

That is the standard.
