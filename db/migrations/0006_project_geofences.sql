CREATE TABLE IF NOT EXISTS "project_geofences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"type" varchar(30) DEFAULT 'circle' NOT NULL,
	"radius_meters" integer DEFAULT 250 NOT NULL,
	"center_lat" double precision,
	"center_lng" double precision,
	"polygon_vertices" json DEFAULT '[]'::json NOT NULL,
	"sealed_by_id" uuid,
	"sealed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"audit_tx" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_geofences_project_id_unique" UNIQUE("project_id")
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_geofences" ADD CONSTRAINT "project_geofences_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_geofences" ADD CONSTRAINT "project_geofences_sealed_by_id_users_id_fk" FOREIGN KEY ("sealed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
