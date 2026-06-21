CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "admin_user_stub" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"roles" text[] DEFAULT ARRAY['admin']::text[] NOT NULL,
	"is_production_auth" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_conversation" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"channel" text DEFAULT 'website' NOT NULL,
	"external_thread_id" text,
	"status" text DEFAULT 'open' NOT NULL,
	"intent" text,
	"action_trace" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_message" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"direction" text NOT NULL,
	"message_type" text DEFAULT 'text' NOT NULL,
	"content" text NOT NULL,
	"source_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"action_trace" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_item" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"content_type" text NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"published_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_version" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"state" text NOT NULL,
	"snapshot_json" jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rag_chunk" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"source_version_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"section" text DEFAULT 'body' NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"embedding" vector(1024) NOT NULL,
	"embedding_model" text DEFAULT 'stub/hash-v1' NOT NULL,
	"embedding_dimension" integer DEFAULT 1024 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rag_document" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid NOT NULL,
	"source_version_id" uuid NOT NULL,
	"title" text NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"status" text DEFAULT 'indexed' NOT NULL,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"indexed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"domain" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_user_stub" ADD CONSTRAINT "admin_user_stub_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_conversation" ADD CONSTRAINT "channel_conversation_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_message" ADD CONSTRAINT "channel_message_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_message" ADD CONSTRAINT "channel_message_conversation_id_channel_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."channel_conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_item" ADD CONSTRAINT "content_item_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_version" ADD CONSTRAINT "content_version_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_chunk" ADD CONSTRAINT "rag_chunk_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_chunk" ADD CONSTRAINT "rag_chunk_document_id_rag_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."rag_document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_chunk" ADD CONSTRAINT "rag_chunk_source_version_id_content_version_id_fk" FOREIGN KEY ("source_version_id") REFERENCES "public"."content_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_document" ADD CONSTRAINT "rag_document_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_document" ADD CONSTRAINT "rag_document_source_version_id_content_version_id_fk" FOREIGN KEY ("source_version_id") REFERENCES "public"."content_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_user_stub_email_unique" ON "admin_user_stub" USING btree ("email");--> statement-breakpoint
CREATE INDEX "audit_log_tenant_created_idx" ON "audit_log" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "channel_conversation_tenant_status_idx" ON "channel_conversation" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "channel_message_conversation_created_idx" ON "channel_message" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "content_item_tenant_slug_unique" ON "content_item" USING btree ("tenant_id","slug");--> statement-breakpoint
CREATE INDEX "content_item_tenant_status_idx" ON "content_item" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "content_version_entity_version_unique" ON "content_version" USING btree ("tenant_id","entity_type","entity_id","version_number");--> statement-breakpoint
CREATE INDEX "content_version_entity_idx" ON "content_version" USING btree ("tenant_id","entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rag_chunk_document_index_unique" ON "rag_chunk" USING btree ("document_id","chunk_index");--> statement-breakpoint
CREATE INDEX "rag_chunk_tenant_document_idx" ON "rag_chunk" USING btree ("tenant_id","document_id");--> statement-breakpoint
CREATE INDEX "rag_chunk_embedding_hnsw_idx" ON "rag_chunk" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "rag_document_source_version_unique" ON "rag_document" USING btree ("tenant_id","source_version_id");--> statement-breakpoint
CREATE INDEX "rag_document_tenant_status_idx" ON "rag_document" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_domain_unique" ON "tenant" USING btree ("domain");