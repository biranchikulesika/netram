CREATE TABLE IF NOT EXISTS "project_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"uploaded_by" uuid,
	"captured_at" timestamp with time zone NOT NULL,
	"caption" varchar(500),
	"file_name" varchar(300),
	"mime_type" varchar(100),
	"size_bytes" integer,
	"content_hash" varchar(128),
	"storage_key" varchar(300),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_photos" ADD CONSTRAINT "project_photos_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_photos" ADD CONSTRAINT "project_photos_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;