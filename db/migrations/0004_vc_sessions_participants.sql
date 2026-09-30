ALTER TABLE "vc_sessions" ADD COLUMN IF NOT EXISTS "title" varchar(200) DEFAULT 'Tripartite Review Session' NOT NULL;--> statement-breakpoint
ALTER TABLE "vc_sessions" ADD COLUMN IF NOT EXISTS "status" varchar(20) DEFAULT 'scheduled' NOT NULL;--> statement-breakpoint
ALTER TABLE "vc_sessions" ADD COLUMN IF NOT EXISTS "host_user_id" uuid;--> statement-breakpoint
ALTER TABLE "vc_sessions" ADD COLUMN IF NOT EXISTS "room_name" varchar(120) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "vc_sessions" ADD COLUMN IF NOT EXISTS "provider" varchar(50) DEFAULT 'webrtc' NOT NULL;--> statement-breakpoint
ALTER TABLE "vc_sessions" ADD COLUMN IF NOT EXISTS "scheduled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vc_sessions" ALTER COLUMN "started_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "vc_sessions" ALTER COLUMN "started_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "vc_sessions" ADD COLUMN IF NOT EXISTS "metadata" json;--> statement-breakpoint
ALTER TABLE "vc_sessions" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vc_sessions" ADD CONSTRAINT "vc_sessions_host_user_id_users_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vc_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(50) DEFAULT 'observer' NOT NULL,
	"joined_at" timestamp with time zone,
	"left_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vc_participants" ADD CONSTRAINT "vc_participants_session_id_vc_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."vc_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vc_participants" ADD CONSTRAINT "vc_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
