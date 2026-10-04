CREATE TABLE IF NOT EXISTS "fund_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"programme_id" uuid,
	"organisation_id" uuid,
	"allocated_amount" numeric(18, 2) NOT NULL,
	"fiscal_year" varchar(10) NOT NULL,
	"currency" varchar(5) DEFAULT 'INR' NOT NULL,
	"sanctioned_by_id" uuid,
	"sanctioned_at" timestamp with time zone,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"description" text,
	"notes" text,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fund_allocations_project_idx" ON "fund_allocations" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fund_allocations_org_idx" ON "fund_allocations" USING btree ("organisation_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fund_allocations_fy_idx" ON "fund_allocations" USING btree ("fiscal_year");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fund_releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"allocation_id" uuid NOT NULL,
	"released_amount" numeric(18, 2) NOT NULL,
	"release_date" timestamp with time zone NOT NULL,
	"reference_number" varchar(100) NOT NULL,
	"released_by_id" uuid,
	"remarks" text,
	"status" varchar(20) DEFAULT 'released' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fund_releases_reference_number_unique" UNIQUE("reference_number")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fund_releases_allocation_idx" ON "fund_releases" USING btree ("allocation_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"organisation_id" uuid,
	"allocation_id" uuid,
	"category" varchar(80) NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"transaction_date" timestamp with time zone NOT NULL,
	"vendor_name" varchar(300) NOT NULL,
	"vendor_gstin" varchar(20),
	"invoice_number" varchar(100),
	"invoice_date" timestamp with time zone,
	"payment_reference" varchar(200),
	"payment_method" varchar(50),
	"status" varchar(30) DEFAULT 'draft' NOT NULL,
	"submitted_by_id" uuid,
	"submitted_at" timestamp with time zone,
	"verified_by_id" uuid,
	"verified_at" timestamp with time zone,
	"void_reason" text,
	"voided_by_id" uuid,
	"voided_at" timestamp with time zone,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_project_idx" ON "expenses" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_status_idx" ON "expenses" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_tx_date_idx" ON "expenses" USING btree ("transaction_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_project_invoice_idx" ON "expenses" USING btree ("project_id","invoice_number");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "financial_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expense_id" uuid,
	"project_id" uuid NOT NULL,
	"document_type" varchar(80) NOT NULL,
	"file_name" varchar(300) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256_hash" varchar(64) NOT NULL,
	"storage_key" varchar(300) NOT NULL,
	"verification_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"uploaded_by_id" uuid,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_by_id" uuid,
	"verified_at" timestamp with time zone,
	"rejection_reason" text,
	"duplicate_of_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_docs_expense_idx" ON "financial_documents" USING btree ("expense_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_docs_hash_idx" ON "financial_documents" USING btree ("sha256_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_docs_project_idx" ON "financial_documents" USING btree ("project_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "financial_risk_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(200) NOT NULL,
	"category" varchar(80) NOT NULL,
	"description" text NOT NULL,
	"condition_config" json DEFAULT '{}'::json NOT NULL,
	"weight" integer NOT NULL,
	"severity" varchar(20) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_risk_rules_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "financial_risk_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"organisation_id" uuid,
	"expense_id" uuid,
	"document_id" uuid,
	"allocation_id" uuid,
	"score_contribution" integer NOT NULL,
	"detail" json DEFAULT '{}'::json NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"resolved_by_id" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "risk_events_project_idx" ON "financial_risk_events" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "risk_events_rule_idx" ON "financial_risk_events" USING btree ("rule_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "risk_events_status_idx" ON "financial_risk_events" USING btree ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inspection_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"organisation_id" uuid,
	"allocation_id" uuid,
	"risk_score" integer NOT NULL,
	"risk_level" varchar(20) NOT NULL,
	"trigger_source" varchar(30) NOT NULL,
	"explanation" text NOT NULL,
	"evidence_refs" json DEFAULT '[]'::json NOT NULL,
	"status" varchar(40) DEFAULT 'open' NOT NULL,
	"assigned_inspector_id" uuid,
	"linked_inspection_id" uuid,
	"review_notes" text,
	"resolution" text,
	"reviewer_id" uuid,
	"reviewed_at" timestamp with time zone,
	"dismissed_reason" text,
	"dismissed_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inspection_flags_project_idx" ON "inspection_flags" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inspection_flags_status_idx" ON "inspection_flags" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inspection_flags_risk_level_idx" ON "inspection_flags" USING btree ("risk_level");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fund_allocations" ADD CONSTRAINT "fund_allocations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fund_allocations" ADD CONSTRAINT "fund_allocations_programme_id_programmes_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programmes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fund_allocations" ADD CONSTRAINT "fund_allocations_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fund_allocations" ADD CONSTRAINT "fund_allocations_sanctioned_by_id_users_id_fk" FOREIGN KEY ("sanctioned_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fund_allocations" ADD CONSTRAINT "fund_allocations_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fund_releases" ADD CONSTRAINT "fund_releases_allocation_id_fund_allocations_id_fk" FOREIGN KEY ("allocation_id") REFERENCES "public"."fund_allocations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fund_releases" ADD CONSTRAINT "fund_releases_released_by_id_users_id_fk" FOREIGN KEY ("released_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expenses" ADD CONSTRAINT "expenses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expenses" ADD CONSTRAINT "expenses_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expenses" ADD CONSTRAINT "expenses_allocation_id_fund_allocations_id_fk" FOREIGN KEY ("allocation_id") REFERENCES "public"."fund_allocations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expenses" ADD CONSTRAINT "expenses_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expenses" ADD CONSTRAINT "expenses_verified_by_id_users_id_fk" FOREIGN KEY ("verified_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expenses" ADD CONSTRAINT "expenses_voided_by_id_users_id_fk" FOREIGN KEY ("voided_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_documents" ADD CONSTRAINT "financial_documents_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_documents" ADD CONSTRAINT "financial_documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_documents" ADD CONSTRAINT "financial_documents_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_documents" ADD CONSTRAINT "financial_documents_verified_by_id_users_id_fk" FOREIGN KEY ("verified_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_documents" ADD CONSTRAINT "financial_documents_duplicate_of_id_financial_documents_id_fk" FOREIGN KEY ("duplicate_of_id") REFERENCES "public"."financial_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_risk_rules" ADD CONSTRAINT "financial_risk_rules_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_risk_rules" ADD CONSTRAINT "financial_risk_rules_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_risk_events" ADD CONSTRAINT "financial_risk_events_rule_id_financial_risk_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."financial_risk_rules"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_risk_events" ADD CONSTRAINT "financial_risk_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_risk_events" ADD CONSTRAINT "financial_risk_events_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_risk_events" ADD CONSTRAINT "financial_risk_events_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_risk_events" ADD CONSTRAINT "financial_risk_events_document_id_financial_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."financial_documents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_risk_events" ADD CONSTRAINT "financial_risk_events_allocation_id_fund_allocations_id_fk" FOREIGN KEY ("allocation_id") REFERENCES "public"."fund_allocations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial_risk_events" ADD CONSTRAINT "financial_risk_events_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inspection_flags" ADD CONSTRAINT "inspection_flags_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inspection_flags" ADD CONSTRAINT "inspection_flags_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inspection_flags" ADD CONSTRAINT "inspection_flags_allocation_id_fund_allocations_id_fk" FOREIGN KEY ("allocation_id") REFERENCES "public"."fund_allocations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inspection_flags" ADD CONSTRAINT "inspection_flags_assigned_inspector_id_users_id_fk" FOREIGN KEY ("assigned_inspector_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inspection_flags" ADD CONSTRAINT "inspection_flags_linked_inspection_id_inspections_id_fk" FOREIGN KEY ("linked_inspection_id") REFERENCES "public"."inspections"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inspection_flags" ADD CONSTRAINT "inspection_flags_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "inspection_flags" ADD CONSTRAINT "inspection_flags_dismissed_by_id_users_id_fk" FOREIGN KEY ("dismissed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
