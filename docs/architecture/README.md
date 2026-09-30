# Netram System Architecture

**Authority:** This is the canonical architecture overview for **Netram**. It describes the system as implemented. For historical context and design evolution, consult [`docs/history/`](../history/) and [`docs/decisions/`](../decisions/) (ADRs).

---

## 1. High-Level Visual Architecture (Modular Flow Cards)

```mermaid
flowchart LR
    subgraph C1["CARD 1: Field & Ingestion"]
        direction TB
        M["📱 Inspector Mobile App<br/><i>(Offline SQLite Queue)</i>"]
        C["📹 Facility CCTV Cameras<br/><i>(Remote RTSP Feeds)</i>"]
    end

    subgraph C2["CARD 2: Secure Core Platform"]
        direction TB
        API["⚙️ Fastify REST API<br/><i>(RBAC, Policies & Outbox)</i>"]
        GW["🎥 CCTV Gateway & MediaMTX<br/><i>(WebRTC WHEP / HLS Relay)</i>"]
        RT["⚡ Realtime WebSocket Hub<br/><i>(Live State & Alerts)</i>"]
    end

    subgraph C3["CARD 3: Data & Intelligence"]
        direction TB
        DB[("🗄️ PostgreSQL 16<br/><i>(Drizzle ORM & Audit Trail)</i>")]
        S3[("📁 MinIO S3 Vault<br/><i>(Evidence Media & ATR Docs)</i>")]
        AI["🧠 Advisory AI Engine<br/><i>(FastAPI Anomaly Scoring)</i>"]
    end

    subgraph C4["CARD 4: Command & Oversight"]
        direction TB
        WEB["🖥️ Web Portal & Dashboards<br/><i>(Control Room, Admin & Public)</i>"]
    end

    %% Connections
    M -->|"1. HTTPS Sync<br/>2. Pre-signed S3 PUT"| API
    M -.->|"Direct Binary Upload"| S3
    C -->|"RTSP Media Stream"| GW
    
    API <-->|"Drizzle ORM (SQL)"| DB
    API <-->|"S3 API"| S3
    API <-->|"REST (Advisory Anomaly)"| AI
    API -->|"Outbox Events (Redis)"| RT
    API <-->|"Stream Auth Tokens"| GW

    GW -->|"WebRTC WHEP (<500ms)"| WEB
    RT -->|"WebSocket Events"| WEB
    API <-->|"Typed REST Client"| WEB

    classDef card1 fill:#e0f2fe,stroke:#0284c7,stroke-width:2px,color:#0369a1;
    classDef card2 fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#92400e;
    classDef card3 fill:#dcfce7,stroke:#16a34a,stroke-width:2px,color:#15803d;
    classDef card4 fill:#f3e8ff,stroke:#9333ea,stroke-width:2px,color:#6b21a8;

    class C1 card1;
    class C2 card2;
    class C3 card3;
    class C4 card4;
```

---

## 2. Modular Architecture Tiers

### 📇 Tier 1: Field & Ingestion
* **Components:**
  * **Inspector Mobile Application** (`apps/inspector-mobile` — React Native / Expo)
  * **Facility CCTV Cameras & NVRs** (Edge RTSP feeds)
* **Responsibilities:**
  * Captures on-site inspection observations, geotags, and photographic evidence.
  * Operates offline in remote locations with zero network connectivity via local SQLite.
  * Streams surveillance footage inside facility local networks without exposing credentials.
* **Connectivity:**
  * ➡️ **Core API:** Reconciles queued operations idempotently upon network reconnect (`POST /api/v1/inspections/sync`).
  * ➡️ **MinIO Object Storage:** Uploads high-resolution evidence media using pre-signed S3 URLs with SHA-256 capture-time checksums.
  * ➡️ **CCTV Gateway:** Serves RTSP video streams across the network perimeter on demand.

---

### 📇 Tier 2: Secure Core Platform & Gateway
* **Components:**
  * **Core REST API** (`services/api` — Fastify modular monolith)
  * **Real-Time Hub** (`services/realtime` — Fastify + WebSockets)
  * **CCTV Gateway** (`services/cctv-gateway` — MediaMTX integration bridge)
* **Responsibilities:**
  * Acts as the single authoritative enforcement point for RBAC, Jurisdiction, and Workflow rules.
  * Bridges internal RTSP cameras to browser-friendly WebRTC (WHEP) without exposing camera credentials.
  * Guarantees event delivery consistency via the Transactional Outbox pattern.
* **Connectivity:**
  * ⬅️ **Field:** Authenticates field devices and validates offline sync batches.
  * ➡️ **Storage & AI:** Persists domain state to PostgreSQL and requests advisory anomaly scores.
  * ➡️ **Web Control Room:** Serves management APIs, issues signed stream tokens, and broadcasts live WebSocket alerts.

---

### 📇 Tier 3: Data & Intelligence Vault
* **Components:**
  * **Relational Database** (PostgreSQL 16 via Drizzle ORM in `packages/data`)
  * **Object Storage Vault** (MinIO S3 Bucket)
  * **Advisory AI Engine** (`services/ai` — Python / FastAPI)
  * **Distributed Broker & Background Workers** (Redis 7 + BullMQ)
* **Responsibilities:**
  * Houses all authoritative project records, user identities, inspection findings, and append-only audit trails.
  * Stores tamper-evident media, photo evidence, and Action Taken Reports (ATR).
  * Evaluates anomaly scores advisory-only (never acts as the final judge; outputs reviewable metrics).
* **Connectivity:**
  * ⬅️ **Core API:** Executes transactional persistence queries, manages background job queues, and runs AI inference.
  * ➡️ **Web Control Room:** Provides verified evidence files and structured audit trails.

---

### 📇 Tier 4: Command, Control & Oversight
* **Components:**
  * **Next.js Web Platform** (`apps/web` — App Router + React 19)
  * **Control Room & Monitoring Dashboards**
  * **Public Grievance & Tracking Portal**
* **Responsibilities:**
  * Provides real-time situational awareness to State, District, and Institutional authorities.
  * Enables live CCTV multi-camera wall monitoring with sub-500ms latency.
  * Manages complaint filing, project verification, and corrective action issuance.
* **Connectivity:**
  * ⬅️ **Core API:** Loads operational dashboards, projects, and inspection results.
  * ⬅️ **CCTV Gateway (MediaMTX):** Receives sub-second live video feeds directly in the browser.
  * ⬅️ **Real-Time Hub:** Subscribes to live outbox notifications, risk alerts, and state transitions.

---

## 3. End-to-End Operational Lifecycle Flow

The complete lifecycle of a field inspection, evidence capture, outbox notification, and live CCTV review:

```mermaid
sequenceDiagram
    autonumber
    participant C1 as [Field] Mobile Inspector
    participant C2 as [Core] API & Gateway
    participant C3 as [Storage] PostgreSQL & S3
    participant C4 as [Web] Control Room

    Note over C1: Field visit conducted offline
    C1->>C1: Record findings & compute photo SHA-256 hash in SQLite
    Note over C1, C2: Inspector returns to network coverage
    C1->>C2: 1. Sync Batched Operations (HTTPS / JSON)
    C2->>C3: 2. Check Deduplication & Save Finding (PostgreSQL)
    C2->>C1: 3. Return Pre-signed Upload URL
    C1->>C3: 4. Upload Photo Evidence to MinIO (S3 PUT)
    C1->>C2: 5. Verify Photo Hash Integrity
    
    rect rgb(240, 250, 255)
        Note over C2, C3: Atomic Outbox Transaction
        C2->>C3: 6. Record State Change + Append Audit Trail + Insert Outbox Event
    end

    C3->>C2: 7. BullMQ Worker pushes outbox alert to Redis
    C2->>C4: 8. Real-Time Hub pushes alert over WebSocket
    C4->>C2: 9. Officer clicks alert, requests live CCTV stream
    C2->>C4: 10. Mint signed WHEP stream token
    C4->>C2: 11. Connect to MediaMTX & view live facility feed (<500ms)
```

---

## 4. Major Data Flows & Protocols

| Origin | Destination | Protocol / Interface | Data Exchanged |
| :--- | :--- | :--- | :--- |
| **Mobile Client** | **Core API** | `HTTPS / JSON` REST | Offline operation batches, findings, inspection metadata |
| **Mobile Client** | **Object Storage** | `Pre-signed S3 PUT` | Encrypted photo evidence, capture checksums (SHA-256) |
| **Facility Camera** | **CCTV Gateway** | `RTSP / H.264` | Raw video stream from facility cameras |
| **Core API** | **Database** | `Drizzle ORM (SQL)` | Transactional domain state, outbox events, audit records |
| **Core API** | **AI Engine** | `Internal HTTP REST` | Inference payloads & advisory anomaly scores |
| **CCTV MediaMTX** | **Web Browser** | `WebRTC (WHEP)` / `HLS` | Sub-500ms low-latency video feed |
| **Realtime Hub** | **Web Browser** | `WebSockets (WSS)` | Live alerts, metric changes, sync notifications |
| **Web Browser** | **Core API** | `HTTPS / JSON` REST | Administrative reviews, complaint actions, notice issuances |

---

## 5. Mandatory Engineering Boundaries

1. **Persistence Boundary:** Database access lives strictly in `packages/data`. Drizzle ORM, `postgres` drivers, and raw SQL never appear in presentation applications or secondary services (AGENTS.md §8, §9).
2. **Configuration Boundary:** Environment variables flow exclusively through `packages/config` via typed, validated Zod schemas. No naked `process.env` calls outside configuration definitions (AGENTS.md §21).
3. **Cross-Service Contracts:** Communication across service boundaries occurs strictly via typed clients, HTTP REST APIs, or outbox events — never direct source-code imports (AGENTS.md §63).
4. **Server Authority:** The server is the single source of truth for authorization, jurisdiction enforcement, and workflow state. Realtime WebSockets, AI outputs, and client caches are never authoritative (AGENTS.md §16, §28, §36).
5. **No Vendor Leakage:** Infrastructure tools (PostgreSQL, MinIO, MediaMTX, Redis) sit behind abstract domain adapters (AGENTS.md §64).
6. **Server-Side Information Disclosure:** Fields a user is not authorized to view are omitted entirely from backend responses, never hidden client-side via UI logic (AGENTS.md §34).

---

## 6. Subsystem Reference Documents

- **CCTV & Streaming Architecture:** [`docs/architecture/cctv.md`](cctv.md)
- **Domain Model & DoSJE Standards:** [`docs/domain/README.md`](../domain/README.md) and [`docs/DoSJE.md`](../DoSJE.md)
- **API & Package Contracts:** [`docs/contracts/README.md`](../contracts/README.md)
- **Architecture Decisions (ADRs):** [`docs/decisions/`](../decisions/)
- **Deployment Topology:** [`docs/deployment.md`](../deployment.md)
- **Development & Setup:** [`docs/development/setup.md`](../development/setup.md)
- **Mechanical Boundary Checks:** `pnpm check:architecture` (enforced via `scripts/architecture-check.mjs`)
