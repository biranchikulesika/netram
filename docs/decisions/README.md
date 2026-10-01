# Architecture Decision Records (ADRs)

This directory records all significant, irreversible, or cross-cutting architectural decisions made in the Netram codebase.

Decisions are documented according to **AGENTS.md §1 & §2** to ensure historical context, options considered, and structural rationale are preserved transparently.

---

## Index of Decisions

| ADR                                                                | Title                                                       | Status       | Date       | Primary Impact                                                                                                                    |
| ------------------------------------------------------------------ | ----------------------------------------------------------- | ------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **[`ADR-001`](ADR-001-monorepo.md)**                               | Monorepo with a Modular-Monolith Backend                    | **Accepted** | 2026-09    | Consolidated packages into single pnpm + Turborepo workspace; established REST `/api/v1` modular monolith.                        |
| **[`ADR-002`](ADR-002-remove-reports-analytics.md)**               | Remove Reports and Analytics Domains                        | **Accepted** | 2026-09-23 | Eliminated redundant derived reporting workers and tables; elevated Project Risk Engine and raw inspection records.               |
| **[`ADR-003`](ADR-003-complaint-escalation-corrective-action.md)** | Automate Complaint Escalation into Corrective Action Orders | **Accepted** | 2026-09-26 | Introduced direct complaint-derived corrective action pathway with reviewer determination without fabricating synthetic findings. |

---

## ADR Process

When proposing an architectural boundary change, persistence model shift, or new service:

1. **Create an ADR:** Add a markdown file named `ADR-XXX-<short-title>.md`.
2. **Standard Sections:**
   - **Context:** The current state and operational constraints.
   - **Problem:** Why the current architecture is insufficient or creating friction.
   - **Decision:** The chosen design, changes made, and boundaries established.
   - **Alternatives Considered:** What other designs were evaluated and why they were rejected.
   - **Consequences:** Trade-offs, migrations, and structural outcomes.
3. **Review:** Cross-boundary ADRs require review by the relevant area owners listed in [`docs/OWNERSHIP.md`](../OWNERSHIP.md) and final authorization per AGENTS.md §1.
