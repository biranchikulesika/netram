CREATE TABLE "attendance_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"provider" varchar(100) NOT NULL,
	"device_external_id" varchar(200) NOT NULL,
	"status" varchar(20) DEFAULT 'UNKNOWN' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"last_event_at" timestamp with time zone,
	"sync_cursor" varchar(200),
	"config" json DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_populations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(200) NOT NULL,
	"population_type" varchar(30) DEFAULT 'BENEFICIARY' NOT NULL,
	"expected_strategy" varchar(30) DEFAULT 'CONFIGURED' NOT NULL,
	"expected_count" integer,
	"config" json DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_population_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"population_id" uuid NOT NULL,
	"person_external_id" varchar(200) NOT NULL,
	"netram_user_id" uuid,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_members_population_person" UNIQUE("population_id","person_external_id")
);
--> statement-breakpoint
CREATE TABLE "attendance_identity_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"external_user_id" varchar(200) NOT NULL,
	"person_external_id" varchar(200) NOT NULL,
	"netram_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_identity_device_external" UNIQUE("device_id","external_user_id")
);
--> statement-breakpoint
CREATE TABLE "attendance_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(200) NOT NULL,
	"start_time" varchar(5) NOT NULL,
	"end_time" varchar(5) NOT NULL,
	"population_id" uuid,
	"min_coverage" real DEFAULT 0.5 NOT NULL,
	"config" json DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_configs" (
	"project_id" uuid,
	"day_start_time" varchar(5) DEFAULT '05:00' NOT NULL,
	"thresholds" json DEFAULT '{"crossSourceDiscrepancy":0.15,"historicalDeviation":0.25,"persistenceWindowDays":5,"materialityThreshold":0.1}' NOT NULL,
	"baseline" json DEFAULT '{"windowDays":14,"minObservations":5}' NOT NULL,
	"retention" json DEFAULT '{"rawTransactionsDays":365,"exportsHours":24}' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_configs_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "attendance_raw_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"external_user_id" varchar(200) NOT NULL,
	"device_event_id" varchar(200),
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw_type" varchar(50) NOT NULL,
	"payload" json,
	"sync_cursor" varchar(200),
	"status" varchar(20) DEFAULT 'RECEIVED' NOT NULL,
	"mapping_status" varchar(30),
	"error" text,
	CONSTRAINT "attendance_raw_device_event" UNIQUE("device_id","device_event_id")
);
--> statement-breakpoint
CREATE TABLE "attendance_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"population_id" uuid,
	"person_external_id" varchar(200) NOT NULL,
	"netram_user_id" uuid,
	"event_type" varchar(30) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw_transaction_id" uuid NOT NULL,
	"window_id" uuid,
	"operational_date" varchar(10),
	"dedup_key" varchar(200),
	"status" varchar(20) DEFAULT 'NORMALIZED' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_source_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"source" varchar(30) NOT NULL,
	"window_id" uuid,
	"operational_date" varchar(10) NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"observed_count" integer,
	"expected_count" integer,
	"confidence" real,
	"coverage" varchar(20) DEFAULT 'UNKNOWN' NOT NULL,
	"health" varchar(20) DEFAULT 'UNKNOWN' NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "attendance_calculations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"window_id" uuid NOT NULL,
	"operational_date" varchar(10) NOT NULL,
	"expected" integer,
	"present" integer DEFAULT 0 NOT NULL,
	"absent" integer,
	"unknown" integer DEFAULT 0 NOT NULL,
	"source_counts" json DEFAULT '{}' NOT NULL,
	"coverage" varchar(20) DEFAULT 'UNKNOWN' NOT NULL,
	"data_quality" varchar(20) DEFAULT 'UNKNOWN' NOT NULL,
	"freshness" timestamp with time zone,
	"policy" json DEFAULT '{}' NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_calculation_window_day" UNIQUE("project_id","window_id","operational_date")
);
--> statement-breakpoint
CREATE TABLE "attendance_data_quality" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"source" varchar(30) NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"coverage" varchar(20) DEFAULT 'UNKNOWN' NOT NULL,
	"freshness" timestamp with time zone,
	"duplicate_rate" real,
	"invalid_count" integer DEFAULT 0 NOT NULL,
	"unmatched_count" integer DEFAULT 0 NOT NULL,
	"health" varchar(20) DEFAULT 'UNKNOWN' NOT NULL,
	"assessed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_anomaly_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"population_id" uuid,
	"anomaly_type" varchar(40) NOT NULL,
	"state" varchar(20) DEFAULT 'NEW' NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "attendance_anomalies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"population_id" uuid,
	"window_id" uuid,
	"operational_date" varchar(10),
	"observation_start" timestamp with time zone NOT NULL,
	"observation_end" timestamp with time zone NOT NULL,
	"anomaly_type" varchar(40) NOT NULL,
	"score" real NOT NULL,
	"severity" varchar(20) NOT NULL,
	"confidence" real NOT NULL,
	"data_quality" varchar(20) DEFAULT 'UNKNOWN' NOT NULL,
	"detector_version" varchar(50) NOT NULL,
	"supporting_signals" json DEFAULT '{}' NOT NULL,
	"state" varchar(20) DEFAULT 'NEW' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"group_id" uuid,
	"linked_inspection_id" uuid,
	"linked_complaint_id" uuid,
	"source_data" json DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_review_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"anomaly_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"action" varchar(30) NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"target_type" varchar(20) NOT NULL,
	"target_id" uuid NOT NULL,
	"field" varchar(100) NOT NULL,
	"original_value" json NOT NULL,
	"new_value" json NOT NULL,
	"reason" text NOT NULL,
	"requested_by" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"scope" json DEFAULT '{}' NOT NULL,
	"status" varchar(20) DEFAULT 'REQUESTED' NOT NULL,
	"format" varchar(10) DEFAULT 'csv' NOT NULL,
	"artifact_key" varchar(300),
	"record_count" integer,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"generated_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"downloaded_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE INDEX "attendance_identity_project_idx" ON "attendance_identity_mappings" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "attendance_raw_device_occurred_idx" ON "attendance_raw_transactions" USING btree ("device_id","occurred_at");--> statement-breakpoint
CREATE INDEX "attendance_raw_status_idx" ON "attendance_raw_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "attendance_events_project_operational_idx" ON "attendance_events" USING btree ("project_id","operational_date");--> statement-breakpoint
CREATE INDEX "attendance_events_person_idx" ON "attendance_events" USING btree ("project_id","person_external_id","operational_date");--> statement-breakpoint
CREATE INDEX "attendance_events_dedup_idx" ON "attendance_events" USING btree ("dedup_key");--> statement-breakpoint
CREATE INDEX "attendance_observations_project_date_idx" ON "attendance_source_observations" USING btree ("project_id","operational_date");--> statement-breakpoint
CREATE INDEX "attendance_calculations_project_date_idx" ON "attendance_calculations" USING btree ("project_id","operational_date");--> statement-breakpoint
CREATE INDEX "attendance_dq_project_source_idx" ON "attendance_data_quality" USING btree ("project_id","source","period_end");--> statement-breakpoint
CREATE INDEX "attendance_anomalies_project_state_idx" ON "attendance_anomalies" USING btree ("project_id","state");--> statement-breakpoint
CREATE INDEX "attendance_anomalies_group_idx" ON "attendance_anomalies" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "attendance_review_anomaly_idx" ON "attendance_review_actions" USING btree ("anomaly_id");--> statement-breakpoint
CREATE INDEX "attendance_corrections_project_idx" ON "attendance_corrections" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "attendance_exports_project_status_idx" ON "attendance_exports" USING btree ("project_id","status");--> statement-breakpoint
ALTER TABLE "attendance_devices" ADD CONSTRAINT "attendance_devices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_populations" ADD CONSTRAINT "attendance_populations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_population_members" ADD CONSTRAINT "attendance_population_members_population_id_attendance_populations_id_fk" FOREIGN KEY ("population_id") REFERENCES "public"."attendance_populations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_population_members" ADD CONSTRAINT "attendance_population_members_netram_user_id_users_id_fk" FOREIGN KEY ("netram_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_identity_mappings" ADD CONSTRAINT "attendance_identity_mappings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_identity_mappings" ADD CONSTRAINT "attendance_identity_mappings_device_id_attendance_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."attendance_devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_identity_mappings" ADD CONSTRAINT "attendance_identity_mappings_netram_user_id_users_id_fk" FOREIGN KEY ("netram_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_windows" ADD CONSTRAINT "attendance_windows_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_windows" ADD CONSTRAINT "attendance_windows_population_id_attendance_populations_id_fk" FOREIGN KEY ("population_id") REFERENCES "public"."attendance_populations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_configs" ADD CONSTRAINT "attendance_configs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_raw_transactions" ADD CONSTRAINT "attendance_raw_transactions_device_id_attendance_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."attendance_devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_device_id_attendance_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."attendance_devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_population_id_attendance_populations_id_fk" FOREIGN KEY ("population_id") REFERENCES "public"."attendance_populations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_netram_user_id_users_id_fk" FOREIGN KEY ("netram_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_raw_transaction_id_attendance_raw_transactions_id_fk" FOREIGN KEY ("raw_transaction_id") REFERENCES "public"."attendance_raw_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_window_id_attendance_windows_id_fk" FOREIGN KEY ("window_id") REFERENCES "public"."attendance_windows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_source_observations" ADD CONSTRAINT "attendance_source_observations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_source_observations" ADD CONSTRAINT "attendance_source_observations_window_id_attendance_windows_id_fk" FOREIGN KEY ("window_id") REFERENCES "public"."attendance_windows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_calculations" ADD CONSTRAINT "attendance_calculations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_calculations" ADD CONSTRAINT "attendance_calculations_window_id_attendance_windows_id_fk" FOREIGN KEY ("window_id") REFERENCES "public"."attendance_windows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_data_quality" ADD CONSTRAINT "attendance_data_quality_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_anomaly_groups" ADD CONSTRAINT "attendance_anomaly_groups_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_anomaly_groups" ADD CONSTRAINT "attendance_anomaly_groups_population_id_attendance_populations_id_fk" FOREIGN KEY ("population_id") REFERENCES "public"."attendance_populations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_anomalies" ADD CONSTRAINT "attendance_anomalies_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_anomalies" ADD CONSTRAINT "attendance_anomalies_population_id_attendance_populations_id_fk" FOREIGN KEY ("population_id") REFERENCES "public"."attendance_populations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_anomalies" ADD CONSTRAINT "attendance_anomalies_window_id_attendance_windows_id_fk" FOREIGN KEY ("window_id") REFERENCES "public"."attendance_windows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_anomalies" ADD CONSTRAINT "attendance_anomalies_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_anomalies" ADD CONSTRAINT "attendance_anomalies_group_id_attendance_anomaly_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."attendance_anomaly_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_anomalies" ADD CONSTRAINT "attendance_anomalies_linked_inspection_id_inspections_id_fk" FOREIGN KEY ("linked_inspection_id") REFERENCES "public"."inspections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_anomalies" ADD CONSTRAINT "attendance_anomalies_linked_complaint_id_complaints_id_fk" FOREIGN KEY ("linked_complaint_id") REFERENCES "public"."complaints"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_review_actions" ADD CONSTRAINT "attendance_review_actions_anomaly_id_attendance_anomalies_id_fk" FOREIGN KEY ("anomaly_id") REFERENCES "public"."attendance_anomalies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_review_actions" ADD CONSTRAINT "attendance_review_actions_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_exports" ADD CONSTRAINT "attendance_exports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_exports" ADD CONSTRAINT "attendance_exports_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;