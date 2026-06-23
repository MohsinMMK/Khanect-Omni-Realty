CREATE TABLE IF NOT EXISTS "project_ai_config" (
  "project_id" uuid PRIMARY KEY NOT NULL,
  "tenant_id" uuid NOT NULL,
  "llm_source" text DEFAULT 'platform' NOT NULL,
  "llm_api_key_encrypted" text,
  "llm_base_url" text,
  "llm_model" text,
  "embedding_source" text DEFAULT 'platform' NOT NULL,
  "embedding_provider" text,
  "embedding_api_key_encrypted" text,
  "embedder_url" text,
  "embedding_model" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_ai_config" ADD CONSTRAINT "project_ai_config_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_ai_config" ADD CONSTRAINT "project_ai_config_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "project_ai_config_tenant_idx" ON "project_ai_config" USING btree ("tenant_id");