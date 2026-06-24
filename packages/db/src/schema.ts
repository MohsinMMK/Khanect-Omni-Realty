import { sql } from "drizzle-orm"
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

const vector1024 = customType<{ data: number[] | string; driverData: string }>({
  dataType() {
    return "vector(1024)"
  },
  toDriver(value) {
    return Array.isArray(value) ? `[${value.join(",")}]` : value
  },
})

const vector384 = customType<{ data: number[] | string; driverData: string }>({
  dataType() {
    return "vector(384)"
  },
  toDriver(value) {
    return Array.isArray(value) ? `[${value.join(",")}]` : value
  },
})

const vector768 = customType<{ data: number[] | string; driverData: string }>({
  dataType() {
    return "vector(768)"
  },
  toDriver(value) {
    return Array.isArray(value) ? `[${value.join(",")}]` : value
  },
})

export const schemaMetadata = pgTable("schema_metadata", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const tenant = pgTable(
  "tenant",
  {
    id: uuid("id").primaryKey(),
    name: text("name").notNull(),
    domain: text("domain").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("tenant_domain_unique").on(table.domain)],
)

export const adminUserStub = pgTable(
  "admin_user_stub",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    roles: text("roles").array().notNull().default(sql`ARRAY['admin']::text[]`),
    isProductionAuth: boolean("is_production_auth").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("admin_user_stub_email_unique").on(table.email)],
)

export const project = pgTable(
  "project",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    domain: text("domain"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("project_tenant_status_idx").on(table.tenantId, table.status),
    uniqueIndex("project_tenant_domain_unique").on(table.tenantId, table.domain),
  ],
)

export const projectAiConfig = pgTable(
  "project_ai_config",
  {
    projectId: uuid("project_id")
      .primaryKey()
      .references(() => project.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),
    llmSource: text("llm_source").notNull().default("platform"),
    llmApiKeyEncrypted: text("llm_api_key_encrypted"),
    llmBaseUrl: text("llm_base_url"),
    llmModel: text("llm_model"),
    embeddingSource: text("embedding_source").notNull().default("platform"),
    embeddingProvider: text("embedding_provider"),
    embeddingApiKeyEncrypted: text("embedding_api_key_encrypted"),
    embedderUrl: text("embedder_url"),
    embeddingModel: text("embedding_model"),
    embeddingDimension: integer("embedding_dimension"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("project_ai_config_tenant_idx").on(table.tenantId)],
)

export const chatbot = pgTable(
  "chatbot",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    purpose: text("purpose").notNull().default(""),
    capabilities: jsonb("capabilities")
      .$type<{
        faq: boolean
        leadCapture: boolean
        appointmentBooking: boolean
        propertyRecommendations: boolean
      }>()
      .notNull()
      .default({
        faq: true,
        leadCapture: true,
        appointmentBooking: false,
        propertyRecommendations: false,
      }),
    status: text("status").notNull().default("active"),
    agentKey: text("agent_key").notNull(),
    knowledgeNamespace: text("knowledge_namespace").notNull(),
    runtimeStatus: text("runtime_status").notNull().default("provisioning"),
    lastIndexedContentVersionId: uuid("last_indexed_content_version_id"),
    lastSyncError: text("last_sync_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("chatbot_tenant_project_idx").on(table.tenantId, table.projectId),
    index("chatbot_tenant_status_idx").on(table.tenantId, table.status),
  ],
)

export const contentItem = pgTable(
  "content_item",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),
    contentType: text("content_type").notNull(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    body: text("body").notNull(),
    status: text("status").notNull().default("draft"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    publishedVersionId: uuid("published_version_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("content_item_tenant_slug_unique").on(table.tenantId, table.slug),
    index("content_item_tenant_status_idx").on(table.tenantId, table.status),
  ],
)

export const contentVersion = pgTable(
  "content_version",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    state: text("state").notNull(),
    snapshotJson: jsonb("snapshot_json").$type<Record<string, unknown>>().notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("content_version_entity_version_unique").on(table.tenantId, table.entityType, table.entityId, table.versionNumber),
    index("content_version_entity_idx").on(table.tenantId, table.entityType, table.entityId),
  ],
)

export const chatbotKnowledgeSource = pgTable(
  "chatbot_knowledge_source",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => project.id, { onDelete: "cascade" }),
    chatbotId: uuid("chatbot_id").references(() => chatbot.id, { onDelete: "cascade" }),
    contentItemId: uuid("content_item_id")
      .notNull()
      .references(() => contentItem.id, { onDelete: "cascade" }),
    sourceVersionId: uuid("source_version_id")
      .notNull()
      .references(() => contentVersion.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("indexed"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("chatbot_knowledge_source_unique").on(table.tenantId, table.chatbotId, table.sourceVersionId),
    index("chatbot_knowledge_source_chatbot_idx").on(table.tenantId, table.chatbotId),
  ],
)

export const ragDocument = pgTable(
  "rag_document",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    sourceVersionId: uuid("source_version_id")
      .notNull()
      .references(() => contentVersion.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    language: text("language").notNull().default("en"),
    status: text("status").notNull().default("indexed"),
    chunkCount: integer("chunk_count").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    indexedAt: timestamp("indexed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("rag_document_source_version_unique").on(table.tenantId, table.sourceVersionId),
    index("rag_document_tenant_status_idx").on(table.tenantId, table.status),
  ],
)

export const ragChunk = pgTable(
  "rag_chunk",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => ragDocument.id, { onDelete: "cascade" }),
    sourceVersionId: uuid("source_version_id")
      .notNull()
      .references(() => contentVersion.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    section: text("section").notNull().default("body"),
    content: text("content").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    embedding: vector1024("embedding"),
    embedding384: vector384("embedding_384"),
    embedding768: vector768("embedding_768"),
    embeddingModel: text("embedding_model").notNull().default("stub/hash-v1"),
    embeddingDimension: integer("embedding_dimension").notNull().default(1024),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("rag_chunk_document_index_unique").on(table.documentId, table.chunkIndex),
    index("rag_chunk_tenant_document_idx").on(table.tenantId, table.documentId),
  ],
)

export const channelConnector = pgTable(
  "channel_connector",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    chatbotId: uuid("chatbot_id")
      .notNull()
      .references(() => chatbot.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    status: text("status").notNull().default("not_configured"),
    displayName: text("display_name").notNull(),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("channel_connector_chatbot_channel_unique").on(table.tenantId, table.chatbotId, table.channel),
    index("channel_connector_project_idx").on(table.tenantId, table.projectId),
  ],
)

export const chatbotDeployment = pgTable(
  "chatbot_deployment",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    chatbotId: uuid("chatbot_id")
      .notNull()
      .references(() => chatbot.id, { onDelete: "cascade" }),
    channel: text("channel").notNull().default("website"),
    publicKey: text("public_key").notNull(),
    allowedDomains: text("allowed_domains").array().notNull().default(sql`ARRAY[]::text[]`),
    installStatus: text("install_status").notNull().default("not_installed"),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("chatbot_deployment_public_key_unique").on(table.publicKey),
    uniqueIndex("chatbot_deployment_chatbot_channel_unique").on(table.tenantId, table.chatbotId, table.channel),
  ],
)

export const channelConversation = pgTable(
  "channel_conversation",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    chatbotId: uuid("chatbot_id")
      .notNull()
      .references(() => chatbot.id, { onDelete: "cascade" }),
    channel: text("channel").notNull().default("website"),
    externalThreadId: text("external_thread_id"),
    status: text("status").notNull().default("open"),
    intent: text("intent"),
    actionTrace: jsonb("action_trace").$type<Record<string, unknown>>().notNull().default({}),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("channel_conversation_tenant_status_idx").on(table.tenantId, table.status),
    index("channel_conversation_chatbot_idx").on(table.tenantId, table.chatbotId, table.updatedAt),
    uniqueIndex("channel_conversation_external_thread_unique").on(table.tenantId, table.chatbotId, table.channel, table.externalThreadId),
  ],
)

export const channelMessage = pgTable(
  "channel_message",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => channelConversation.id, { onDelete: "cascade" }),
    direction: text("direction").notNull(),
    messageType: text("message_type").notNull().default("text"),
    content: text("content").notNull(),
    sourceIds: text("source_ids").array().notNull().default(sql`ARRAY[]::text[]`),
    actionTrace: jsonb("action_trace").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("channel_message_conversation_created_idx").on(table.conversationId, table.createdAt)],
)

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id").references(() => tenant.id, { onDelete: "set null" }),
    actorId: uuid("actor_id"),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("audit_log_tenant_created_idx").on(table.tenantId, table.createdAt)],
)
