-- Call Contacts and Call Records for Video Oversight
CREATE TABLE IF NOT EXISTS "call_contacts" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"role" varchar(50) DEFAULT 'staff' NOT NULL,
	"title" varchar(200) NOT NULL,
	"project_id" uuid,
	"project_code" varchar(50) NOT NULL,
	"project_name" varchar(300) NOT NULL,
	"phone" varchar(40) NOT NULL,
	"is_online" boolean DEFAULT true NOT NULL,
	"avatar_color" varchar(30) DEFAULT '#2563EB' NOT NULL,
	"video_uri" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "call_contacts" ADD CONSTRAINT "call_contacts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "call_records" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"contact_id" varchar(64) NOT NULL,
	"contact_name" varchar(200) NOT NULL,
	"contact_title" varchar(200) NOT NULL,
	"role" varchar(50) DEFAULT 'staff' NOT NULL,
	"project_id" uuid,
	"project_code" varchar(50) NOT NULL,
	"project_name" varchar(300) NOT NULL,
	"call_type" varchar(30) DEFAULT 'video' NOT NULL,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"direction" varchar(20) DEFAULT 'outgoing' NOT NULL,
	"status" varchar(20) DEFAULT 'answered' NOT NULL,
	"condition" varchar(50) DEFAULT 'satisfactory' NOT NULL,
	"review_text" text NOT NULL,
	"flag_inspection" boolean DEFAULT false NOT NULL,
	"video_uri" text,
	"inspector_video_uri" text,
	"started_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "call_records" ADD CONSTRAINT "call_records_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
