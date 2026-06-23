ALTER TABLE "chatbot" ADD COLUMN IF NOT EXISTS "agent_key" text;
--> statement-breakpoint
ALTER TABLE "chatbot" ADD COLUMN IF NOT EXISTS "knowledge_namespace" text;
--> statement-breakpoint
ALTER TABLE "chatbot" ADD COLUMN IF NOT EXISTS "runtime_status" text;
--> statement-breakpoint
ALTER TABLE "chatbot" ADD COLUMN IF NOT EXISTS "last_indexed_content_version_id" uuid;
--> statement-breakpoint
ALTER TABLE "chatbot" ADD COLUMN IF NOT EXISTS "last_sync_error" text;
--> statement-breakpoint
UPDATE "chatbot"
SET
  "agent_key" = COALESCE("agent_key", 'chatbot_' || replace("id"::text, '-', '')),
  "knowledge_namespace" = COALESCE("knowledge_namespace", 'knowledge_' || replace("id"::text, '-', '')),
  "runtime_status" = COALESCE("runtime_status", 'ready');
--> statement-breakpoint
ALTER TABLE "chatbot" ALTER COLUMN "agent_key" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "chatbot" ALTER COLUMN "knowledge_namespace" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "chatbot" ALTER COLUMN "runtime_status" SET DEFAULT 'ready';
--> statement-breakpoint
ALTER TABLE "chatbot" ALTER COLUMN "runtime_status" SET NOT NULL;
