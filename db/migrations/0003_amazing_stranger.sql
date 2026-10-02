CREATE TABLE "inspection_sync_operations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"inspection_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"operation_type" varchar(50) NOT NULL,
	"payload" json DEFAULT '{}'::json NOT NULL,
	"status" varchar(30) NOT NULL,
	"code" varchar(50),
	"message" text,
	"result_data" json,
	"client_timestamp" timestamp with time zone NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inspection_sync_operations" ADD CONSTRAINT "inspection_sync_operations_inspection_id_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_sync_operations" ADD CONSTRAINT "inspection_sync_operations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;