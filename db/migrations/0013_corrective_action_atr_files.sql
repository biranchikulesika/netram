-- ATR supporting attachments (docs/DoSJE.md §16): institutions lodge PDFs,
-- photos, videos with the Action Taken Report. Files live in object storage;
-- metadata only here (AGENTS.md §30). The human ATR reference code is not part
-- of the domain anymore.
CREATE TABLE IF NOT EXISTS "corrective_action_files" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "corrective_action_id" uuid NOT NULL REFERENCES "corrective_actions"("id") ON DELETE CASCADE,
  "file_name" varchar(300) NOT NULL,
  "mime_type" varchar(100) NOT NULL,
  "size_bytes" integer NOT NULL,
  "content_hash" varchar(128) NOT NULL,
  "storage_key" varchar(300) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "corrective_action_files_ca_idx" ON "corrective_action_files" ("corrective_action_id");

ALTER TABLE "corrective_actions" DROP COLUMN IF EXISTS "atr_code";