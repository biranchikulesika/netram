-- 0018: Query-supporting indexes for the Action Inbox and financial workloads.
--
-- The inbox aggregates "awaiting decision" queues across modules (AGENTS.md
-- §32): status + recency reads scoped by joining projects on district. Each
-- index below backs one such read that previously scanned:
--   attendance_anomalies(state, created_at)     - NEW-anomaly review queue
--   attendance_corrections(status, created_at)  - pending approval queue
--   expenses(status, submitted_at)              - submitted/under_review queue
--   financial_documents(verification_status, created_at) - pending verification
--
-- Also adds a complaint received-date index: the complaint queue orders and
-- filters on received_at with status predicates (§35 oversight flow). Complaint
-- jurisdiction is resolved through the project join, so no district column
-- index is added there.

CREATE INDEX IF NOT EXISTS "attendance_anomalies_state_created_idx" ON "attendance_anomalies" ("state","created_at");
CREATE INDEX IF NOT EXISTS "attendance_anomalies_severity_idx" ON "attendance_anomalies" ("severity");
CREATE INDEX IF NOT EXISTS "attendance_corrections_status_created_idx" ON "attendance_corrections" ("status","created_at");
CREATE INDEX IF NOT EXISTS "expenses_status_submitted_idx" ON "expenses" ("status","submitted_at");
CREATE INDEX IF NOT EXISTS "financial_docs_status_created_idx" ON "financial_documents" ("verification_status","created_at");
CREATE INDEX IF NOT EXISTS "complaints_status_received_idx" ON "complaints" ("status","received_at");
CREATE INDEX IF NOT EXISTS "projects_status_district_idx" ON "projects" ("status","district_id");
CREATE INDEX IF NOT EXISTS "inspections_status_idx" ON "inspections" ("status");
CREATE INDEX IF NOT EXISTS "inspections_project_idx" ON "inspections" ("project_id");
CREATE INDEX IF NOT EXISTS "ai_anomalies_status_created_idx" ON "ai_anomalies" ("status","created_at");
CREATE INDEX IF NOT EXISTS "ai_anomalies_inspection_idx" ON "ai_anomalies" ("inspection_id");
CREATE INDEX IF NOT EXISTS "outbox_events_status_idx" ON "outbox_events" ("status","available_after");
CREATE INDEX IF NOT EXISTS "outbox_events_type_idx" ON "outbox_events" ("type");
CREATE INDEX IF NOT EXISTS "outbox_events_resource_idx" ON "outbox_events" ("resource_type","resource_id");
