CREATE TABLE IF NOT EXISTS "project_risk_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"scoring_version" varchar(50) NOT NULL,
	"total_score" integer NOT NULL,
	"risk_level" varchar(20) NOT NULL,
	"financial_score" integer NOT NULL,
	"inspection_quality_score" integer NOT NULL,
	"attendance_anomaly_score" integer NOT NULL,
	"complaint_density_score" integer NOT NULL,
	"ai_anomaly_score" integer NOT NULL,
	"financial_signals" json DEFAULT '{}'::json NOT NULL,
	"inspection_quality_signals" json DEFAULT '{}'::json NOT NULL,
	"attendance_anomaly_signals" json DEFAULT '{}'::json NOT NULL,
	"complaint_density_signals" json DEFAULT '{}'::json NOT NULL,
	"ai_anomaly_signals" json DEFAULT '{}'::json NOT NULL,
	"top_contributors" json DEFAULT '[]'::json NOT NULL,
	"explanation" text NOT NULL,
	"inspection_flag_id" uuid,
	"scheduled_inspection_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_risk_snapshots_project_idx" ON "project_risk_snapshots" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_risk_snapshots_calculated_at_idx" ON "project_risk_snapshots" USING btree ("calculated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_risk_snapshots_total_score_idx" ON "project_risk_snapshots" USING btree ("total_score");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_risk_snapshots_risk_level_idx" ON "project_risk_snapshots" USING btree ("risk_level");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_risk_snapshots" ADD CONSTRAINT "project_risk_snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_risk_snapshots" ADD CONSTRAINT "project_risk_snapshots_inspection_flag_id_inspection_flags_id_fk" FOREIGN KEY ("inspection_flag_id") REFERENCES "public"."inspection_flags"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_risk_snapshots" ADD CONSTRAINT "project_risk_snapshots_scheduled_inspection_id_inspections_id_fk" FOREIGN KEY ("scheduled_inspection_id") REFERENCES "public"."inspections"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
INSERT INTO "permissions" ("code", "name", "description")
VALUES 
  ('project_risk:read', 'Read Project Risk Scores', 'Allows viewing project risk rankings and snapshots'),
  ('project_risk:evaluate', 'Evaluate Project Risk', 'Allows triggering project risk scoring and evaluation')
ON CONFLICT ("code") DO NOTHING;
