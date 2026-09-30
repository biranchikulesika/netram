-- Exact camera-to-project attribution (control room, AGENTS.md §42):
-- a camera watches one monitored target; replaces name-matching heuristics.
ALTER TABLE "cctv_cameras" ADD COLUMN IF NOT EXISTS "project_id" uuid REFERENCES "projects"("id");
CREATE INDEX IF NOT EXISTS "cctv_cameras_project_idx" ON "cctv_cameras" ("project_id");
