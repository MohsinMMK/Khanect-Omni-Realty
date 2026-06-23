CREATE TABLE "channel_connector" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"chatbot_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"status" text DEFAULT 'not_configured' NOT NULL,
	"display_name" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatbot" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"purpose" text DEFAULT '' NOT NULL,
	"capabilities" jsonb DEFAULT '{"faq":true,"leadCapture":true,"appointmentBooking":false}'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"agent_key" text NOT NULL,
	"knowledge_namespace" text NOT NULL,
	"runtime_status" text DEFAULT 'ready' NOT NULL,
	"last_indexed_content_version_id" uuid,
	"last_sync_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatbot_deployment" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"chatbot_id" uuid NOT NULL,
	"channel" text DEFAULT 'website' NOT NULL,
	"public_key" text NOT NULL,
	"allowed_domains" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"install_status" text DEFAULT 'not_installed' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatbot_knowledge_source" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"chatbot_id" uuid NOT NULL,
	"content_item_id" uuid NOT NULL,
	"source_version_id" uuid NOT NULL,
	"status" text DEFAULT 'indexed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channel_conversation" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "channel_conversation" ADD COLUMN "chatbot_id" uuid;--> statement-breakpoint
CREATE TABLE "project" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channel_connector" ADD CONSTRAINT "channel_connector_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_connector" ADD CONSTRAINT "channel_connector_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_connector" ADD CONSTRAINT "channel_connector_chatbot_id_chatbot_id_fk" FOREIGN KEY ("chatbot_id") REFERENCES "public"."chatbot"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatbot" ADD CONSTRAINT "chatbot_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatbot" ADD CONSTRAINT "chatbot_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatbot_deployment" ADD CONSTRAINT "chatbot_deployment_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatbot_deployment" ADD CONSTRAINT "chatbot_deployment_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatbot_deployment" ADD CONSTRAINT "chatbot_deployment_chatbot_id_chatbot_id_fk" FOREIGN KEY ("chatbot_id") REFERENCES "public"."chatbot"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatbot_knowledge_source" ADD CONSTRAINT "chatbot_knowledge_source_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatbot_knowledge_source" ADD CONSTRAINT "chatbot_knowledge_source_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatbot_knowledge_source" ADD CONSTRAINT "chatbot_knowledge_source_chatbot_id_chatbot_id_fk" FOREIGN KEY ("chatbot_id") REFERENCES "public"."chatbot"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatbot_knowledge_source" ADD CONSTRAINT "chatbot_knowledge_source_content_item_id_content_item_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatbot_knowledge_source" ADD CONSTRAINT "chatbot_knowledge_source_source_version_id_content_version_id_fk" FOREIGN KEY ("source_version_id") REFERENCES "public"."content_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_conversation" ADD CONSTRAINT "channel_conversation_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_conversation" ADD CONSTRAINT "channel_conversation_chatbot_id_chatbot_id_fk" FOREIGN KEY ("chatbot_id") REFERENCES "public"."chatbot"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "channel_connector_chatbot_channel_unique" ON "channel_connector" USING btree ("tenant_id","chatbot_id","channel");--> statement-breakpoint
CREATE INDEX "channel_connector_project_idx" ON "channel_connector" USING btree ("tenant_id","project_id");--> statement-breakpoint
CREATE INDEX "channel_conversation_chatbot_idx" ON "channel_conversation" USING btree ("tenant_id","chatbot_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_conversation_external_thread_unique" ON "channel_conversation" USING btree ("tenant_id","chatbot_id","channel","external_thread_id");--> statement-breakpoint
CREATE INDEX "chatbot_tenant_project_idx" ON "chatbot" USING btree ("tenant_id","project_id");--> statement-breakpoint
CREATE INDEX "chatbot_tenant_status_idx" ON "chatbot" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "chatbot_deployment_public_key_unique" ON "chatbot_deployment" USING btree ("public_key");--> statement-breakpoint
CREATE UNIQUE INDEX "chatbot_deployment_chatbot_channel_unique" ON "chatbot_deployment" USING btree ("tenant_id","chatbot_id","channel");--> statement-breakpoint
CREATE UNIQUE INDEX "chatbot_knowledge_source_unique" ON "chatbot_knowledge_source" USING btree ("tenant_id","chatbot_id","source_version_id");--> statement-breakpoint
CREATE INDEX "chatbot_knowledge_source_chatbot_idx" ON "chatbot_knowledge_source" USING btree ("tenant_id","chatbot_id");--> statement-breakpoint
CREATE INDEX "project_tenant_status_idx" ON "project" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "project_tenant_domain_unique" ON "project" USING btree ("tenant_id","domain");
