-- Supporting attachments (PDFs, photos, videos, docs) lodged by citizens with
-- a public grievance (netram complaint registration portal). Blobs live in
-- object storage; only metadata persists here (AGENTS.md §30).
CREATE TABLE IF NOT EXISTS "complaint_files" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "complaint_id" uuid NOT NULL REFERENCES "complaints"("id") ON DELETE CASCADE,
  "file_name" varchar(300) NOT NULL,
  "mime_type" varchar(100) NOT NULL,
  "size_bytes" integer NOT NULL,
  "content_hash" varchar(128) NOT NULL,
  "storage_key" varchar(300) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "complaint_files_complaint_idx" ON "complaint_files" ("complaint_id");