# Netram Documentation Index

Welcome to the **Netram Platform Documentation**. This index provides a complete roadmap for engineers, reviewers, and system operators navigating the codebase.

Netram is a real-time smart monitoring and inspection platform developed for the **Department of Social Justice & Empowerment (DoSJE)**, Government of India (Smart India Hackathon problem statement **SIH26095**).

---

## 🏛️ Core Specifications & Operating Principles

| Document | Description |
|---|---|
| **[`../AGENTS.md`](../AGENTS.md)** | **The Authoritative Engineering Operating Manual.** Defines architectural priorities, boundaries, transaction rules, authority models, privacy, and development behavior. |
| **[`../DESIGN.md`](../DESIGN.md)** | **Design System Specification.** Government product standards, strict 8-color palette, typography tokens, status mappings, and WCAG accessibility standards. |
| **[`OWNERSHIP.md`](OWNERSHIP.md)** | **Team Ownership & Governance.** Review responsibilities, GitHub handles, area breakdown, and CODEOWNERS rules. |

---

## 🗺️ Documentation Directory Roadmap

```
docs/
├── architecture/         # High-level architecture, 4 modular tiers, data flows, CCTV streaming
│   ├── README.md         # Visual flow cards, system tiers, operational sequence diagram, boundaries
│   └── cctv.md           # Authoritative CCTV media plane (MediaMTX, WebRTC/WHEP, external auth)
│
├── domain/               # Core domain concepts, state machines, authority & jurisdiction
│   ├── README.md         # Domain entities, project lifecycle, inspection/ATR pipeline, AI advisory
│   └── DoSJE.md          # Comprehensive DoSJE knowledge base: schemes (AVYAY, NAPDDR, etc.), social audits
│
├── contracts/            # Typed interfaces, runtime validation, and API surfaces
│   └── README.md         # OpenAPI 3.1 REST catalogue (/api/v1/), shared workspace packages, type inventory
│
├── decisions/            # Architecture Decision Records (ADRs)
│   ├── README.md         # ADR index, status, and proposal process
│   ├── ADR-001-*.md      # Monorepo with modular-monolith backend
│   ├── ADR-002-*.md      # Removal of redundant reports & analytics pipelines
│   └── ADR-003-*.md      # Direct complaint-derived corrective action pathway
│
├── development/          # Day-to-day developer guides and environments
│   ├── README.md         # Development quickstart, CLI commands, and quality gates
│   ├── setup.md          # Installation, Docker infra, DB lifecycle (reset/seed), service startup
│   └── environments.md   # Environment matrix (dev, ci, demo, prod), port allocations, and isolation
│
├── deployment.md         # Production single-VPS topology (nginx, rootless Podman, MediaMTX)
│
└── history/              # Historical records and technical evolution
    ├── README.md         # History archive index
    └── cctv-evolution.md # Pre-build streaming audit and 5-phase CCTV reconstruction log
```

---

## 🚀 Quick Links for Common Tasks

- **Getting Started Locally:** Follow [`development/setup.md`](development/setup.md).
- **Understanding How Video Streams Work:** Read [`architecture/cctv.md`](architecture/cctv.md).
- **Browsing API Endpoints:** Check [`contracts/README.md`](contracts/README.md).
- **Learning DoSJE Scheme Ground Reality:** Read [`DoSJE.md`](DoSJE.md).
- **Running Verifications & Tests:** See [`development/README.md`](development/README.md).
