UPDATE "chatbot"
SET "runtime_status" = 'live'
WHERE "runtime_status" = 'ready';
--> statement-breakpoint
ALTER TABLE "chatbot" ALTER COLUMN "runtime_status" SET DEFAULT 'provisioning';
