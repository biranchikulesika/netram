-- DoSJE domain alignment (docs/DoSJE.md §31):
-- geography below district, scheme components, finding issue categories,
-- ATR fields on corrective actions, organisation state binding.

-- ### Geography: block / gram panchayat / village ###
CREATE TABLE IF NOT EXISTS "blocks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "district_id" uuid NOT NULL REFERENCES "districts"("id"),
  "code" varchar(20) UNIQUE NOT NULL,
  "name" varchar(200) NOT NULL
);

CREATE TABLE IF NOT EXISTS "gram_panchayats" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "block_id" uuid NOT NULL REFERENCES "blocks"("id"),
  "code" varchar(20) UNIQUE NOT NULL,
  "name" varchar(200) NOT NULL
);

CREATE TABLE IF NOT EXISTS "villages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "gram_panchayat_id" uuid NOT NULL REFERENCES "gram_panchayats"("id"),
  "code" varchar(20) UNIQUE NOT NULL,
  "name" varchar(200) NOT NULL
);

-- ### Organisations: state binding (SAUs, state departments) ###
ALTER TABLE "organisations" ADD COLUMN IF NOT EXISTS "state_id" uuid REFERENCES "states"("id");

-- ### Scheme components ###
CREATE TABLE IF NOT EXISTS "scheme_components" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "programme_id" uuid NOT NULL REFERENCES "programmes"("id") ON DELETE CASCADE,
  "code" varchar(50) UNIQUE NOT NULL,
  "name" varchar(300) NOT NULL,
  "description" text,
  "target_kind" varchar(50) DEFAULT 'institution' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "scheme_components_programme_idx" ON "scheme_components" ("programme_id");

-- ### Projects: village location + scheme component ###
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "village_id" uuid REFERENCES "villages"("id");
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "scheme_component_id" uuid REFERENCES "scheme_components"("id");

-- ### Findings: issue category, amount, responsible organisation ###
CREATE TABLE IF NOT EXISTS "finding_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" varchar(50) UNIQUE NOT NULL,
  "name" varchar(200) NOT NULL,
  "description" text
);
ALTER TABLE "findings" ADD COLUMN IF NOT EXISTS "category_id" uuid REFERENCES "finding_categories"("id");
ALTER TABLE "findings" ADD COLUMN IF NOT EXISTS "amount_inr" integer;
ALTER TABLE "findings" ADD COLUMN IF NOT EXISTS "responsible_organisation_id" uuid REFERENCES "organisations"("id");

-- ### Corrective actions: Action Taken Report fields ###
ALTER TABLE "corrective_actions" ADD COLUMN IF NOT EXISTS "action_summary" text;
ALTER TABLE "corrective_actions" ADD COLUMN IF NOT EXISTS "atr_code" varchar(50);
ALTER TABLE "corrective_actions" ADD COLUMN IF NOT EXISTS "verified_at" timestamp with time zone;
ALTER TABLE "corrective_actions" ADD COLUMN IF NOT EXISTS "verified_by_user_id" uuid REFERENCES "users"("id");
ALTER TABLE "corrective_actions" ADD COLUMN IF NOT EXISTS "review_remarks" text;
