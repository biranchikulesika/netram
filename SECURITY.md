# Security Policy — Netram

This project is a Smart India Hackathon 2026 submission developed by the Netram student team for the Department of Social Justice & Empowerment (DoSJE) monitoring workflows.

We take the security and integrity of this platform seriously. This document outlines our responsible disclosure process and the security principles embedded in the Netram architecture.

---

## 1. Reporting a Vulnerability

If you discover a security vulnerability or potential exposure in the Netram codebase or deployed demo services, please report it responsibly:

* **Email:** [netram@kulesika.in](mailto:netram@kulesika.in)
* **Response Time:** We will acknowledge receipt of your report within 48 hours.

Please **do not** create public GitHub issues or post public discussions regarding unpatched vulnerabilities. All communications should go directly to the dedicated security inbox at **netram@kulesika.in**.

### What to include in your report:
- A clear description of the vulnerability and its potential impact.
- Step-by-step instructions or a minimal proof-of-concept (PoC) to reproduce the issue.
- The specific affected endpoint, file, or component.
- Any suggested remediation or mitigation steps.

---

## 2. Supported Versions

Only the latest code on the active branches is actively maintained and eligible for security fixes:

| Branch | Supported | Notes |
| :--- | :--- | :--- |
| `main` | ✅ Yes | Production / demo deployment branch |
| `develop` | ✅ Yes | Active development and integration |
| Historical tags / forks | ❌ No | Please re-verify on `main` before reporting |

---

## 3. Core Security Architecture & Principles

The Netram platform is built with defensive engineering standards across all layers:

1. **Server Authority (Zero Client Trust):**
   Authentication, authorization, workflow state transitions, and jurisdiction boundaries are strictly enforced on the server. The client application is treated as untrusted presentation; client-side checks exist only for user experience.

2. **Server-Side Data Minimization (Selective Disclosure):**
   Information disclosure is governed by policy. If a user or role is not authorized to see a specific field or record within a jurisdiction, the backend omits the data entirely from the API response rather than sending it to be hidden by frontend CSS or UI toggles.

3. **Tamper-Evident Evidence Integrity:**
   Inspection media (photos, videos) captured in the field are hashed (SHA-256) client-side at capture time. Upon upload, the backend re-computes the hash and verifies byte-level equality before marking the evidence as verified in the immutable ledger.

4. **Sanitized Error Handling:**
   API responses adhere to a uniform, sanitized error contract. Database exceptions, stack traces, ORM queries, and infrastructure provider internals are never leaked in HTTP response payloads.

5. **Secrets Management:**
   No real credentials, production API keys, private certificates, or database passwords are committed to source control. Local development uses synthetic keys and dummy values documented in `.env.example`.

6. **Immutable Audit Trail:**
   All significant administrative operations, state transitions, inspection reviews, and dispute resolutions are captured in an append-only audit trail transactionally bound to the operational state changes via the Transactional Outbox pattern.

---

## 4. Responsible Disclosure & Safe Harbor

We appreciate the efforts of security researchers and evaluators who help keep Netram secure. If you make a good-faith effort to avoid privacy violations, data destruction, and service degradation, and disclose vulnerabilities responsibly via `netram@kulesika.in`, we will work with you to understand and address the issue promptly.
