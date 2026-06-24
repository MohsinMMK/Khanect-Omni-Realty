import type { AppConfig } from "@workspace/config"
import {
  buildAgentCapabilityPolicy,
  createProjectAiRuntimeResolver,
  createStubEmbeddingProvider,
  createUuidV7,
  type AgentCapabilityPolicy,
  type AgentSourceType,
  type EmbeddingProvider,
  type ProjectAiConfigDto,
  type ProjectAiConfigUpdateInput,
  type ProjectAiRuntimeResolver,
  type ProjectAiSecrets,
  type ProjectLlmRuntimeConfig,
} from "@workspace/core"
import { and, desc, eq, like, sql } from "drizzle-orm"
import type { Pool } from "pg"

import type { AppDb } from "./index.js"
import { DEFAULT_TENANT_DOMAIN, serializePgVector } from "./phase1a.js"
import {
  channelConnector,
  channelConversation,
  channelMessage,
  chatbot,
  chatbotDeployment,
  chatbotKnowledgeSource,
  contentItem,
  contentVersion,
  auditLog,
  project,
  ragChunk,
  projectAiConfig,
  ragDocument,
  tenant,
} from "./schema.js"
import {
  applyProjectAiUpdate,
  DEFAULT_PROJECT_AI_KEY_SUMMARY,
  deleteProjectAiRecord,
  loadProjectAiSecretsFromDb,
  mapProjectAiConfigDto,
  mapProjectAiKeySummary,
  mapRowToProjectAiRecord,
  resolveProjectRuntimeProviders,
  upsertProjectAiRecord,
  type ProjectAiRecord,
  type RuntimeAnswerProvider,
} from "./project-ai-store.js"

export type ChatbotCapability = "faq" | "lead_capture" | "appointment_booking"
export type ConnectorChannel = "website" | "whatsapp" | "instagram_dm"
export type ConnectorStatus = "active" | "not_configured" | "needs_credentials" | "error" | "paused"
export type KnowledgeSyncStatus = "pending" | "syncing" | "indexed" | "failed"
export type PlatformContentStatus = "draft" | "published"
export type PlatformContentType = "project" | "property" | "faq" | "area" | "policy" | "general"

export interface ProjectAiKeySummary {
  llmSource: "platform" | "project"
  embeddingSource: "platform" | "project"
}

export interface ProjectDto {
  id: string
  name: string
  domain: string | null
  status: "active" | "archived"
  aiKeys: ProjectAiKeySummary
  createdAt: string
  updatedAt: string
}

export interface ChatbotCapabilitiesDto {
  faq: boolean
  leadCapture: boolean
  appointmentBooking: boolean
  propertyRecommendations: boolean
}

export interface ChatbotDto {
  id: string
  projectId: string
  name: string
  purpose: string
  capabilities: ChatbotCapabilitiesDto
  status: "draft" | "active" | "archived"
  agentKey: string
  knowledgeNamespace: string
  runtimeStatus: "provisioning" | "live" | "syncing" | "error" | "paused"
  lastIndexedContentVersionId: string | null
  lastSyncError: string | null
  createdAt: string
  updatedAt: string
}

export interface PlatformContentItemDto {
  id: string
  projectId: string
  chatbotId: string
  contentType: PlatformContentType
  title: string
  slug: string
  body: string
  status: PlatformContentStatus
  publishedVersionId: string | null
  createdAt: string
  updatedAt: string
}

export interface PlatformKnowledgeSourceDto {
  id: string
  chatbotId: string
  contentItemId: string
  sourceVersionId: string
  title: string
  sourceType: PlatformContentType
  chunkCount: number
  status: KnowledgeSyncStatus
  indexedAt: string
}

export interface PlatformSourceDto {
  chunkId: string
  knowledgeSourceId: string
  title: string
  excerpt: string
  score: number
  sourceType: PlatformContentType
}

export interface PlatformChatAnswerDto {
  answer: string
  fallback: boolean
  sources: PlatformSourceDto[]
  channel: ConnectorChannel
  retrieval: {
    topK: number
    model: string
  }
  confidence: "none" | "low" | "medium" | "high"
  actionTrace: Record<string, unknown>
  agentTraceId?: string
}

export interface PlatformAnswerProviderInput {
  message: string
  sources: PlatformSourceDto[]
  chatbot: ChatbotDto
  chatbotId: string
  channel: ConnectorChannel
  policy: AgentCapabilityPolicy
  llmConfig?: ProjectLlmRuntimeConfig
}

export interface PlatformAnswerProviderResult {
  answer: string
  model: string
  confidence?: PlatformChatAnswerDto["confidence"]
  actionTrace?: Record<string, unknown>
  agentTraceId?: string
}

export type PlatformAnswerProvider = (input: PlatformAnswerProviderInput) => Promise<PlatformAnswerProviderResult>

export interface PlatformPublishResult {
  item: PlatformContentItemDto
  source: PlatformKnowledgeSourceDto
  chunkCount: number
  documentId: string
  indexing: boolean
}

export interface PlatformIndexInput {
  chatbotId: string
  contentItemId: string
  sourceVersionId: string
  documentId: string
  embed: EmbeddingProvider
}

export interface ProductionChatbotStoreOptions {
  answerProvider?: PlatformAnswerProvider
  embeddingProvider?: EmbeddingProvider
  appConfig?: AppConfig
  encryptionKey?: string
  projectAiResolver?: ProjectAiRuntimeResolver
  answerProviderPriority?: "project" | "default"
}

export interface ChannelConnectorDto {
  id: string
  chatbotId: string
  channel: ConnectorChannel
  status: ConnectorStatus
  displayName: string
  config: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface ChatbotDeploymentDto {
  id: string
  chatbotId: string
  channel: "website"
  publicKey: string
  allowedDomains: string[]
  installStatus: "not_installed" | "installed" | "unverified"
  installSnippet: string
  createdAt: string
  updatedAt: string
}

export interface PlatformConversationSummaryDto {
  id: string
  chatbotId: string
  channel: ConnectorChannel
  externalThreadId: string | null
  status: string
  messageCount: number
  lastUserMessage: string | null
  lastAssistantMessage: string | null
  lastMessageAt: string | null
  createdAt: string
  updatedAt: string
}

export interface PlatformAgentActionDto {
  id: string
  toolName: string
  status: string
  payload: Record<string, unknown>
  createdAt: string
}

export interface ProductionChatbotStore {
  listProjects(): Promise<ProjectDto[]>
  createProject(input: { name: string; domain?: string | null }): Promise<ProjectDto>
  getProject(id: string): Promise<ProjectDto | null>
  archiveProject(id: string): Promise<ProjectDto | null>
  unarchiveProject(id: string): Promise<ProjectDto | null>
  deleteProject(id: string): Promise<ProjectDto | null>
  getProjectAiConfig(projectId: string): Promise<ProjectAiConfigDto | null>
  updateProjectAiConfig(projectId: string, input: ProjectAiConfigUpdateInput): Promise<ProjectAiConfigDto | null>
  getProjectAiSecrets(projectId: string): Promise<ProjectAiSecrets | null>
  listChatbots(projectId: string): Promise<ChatbotDto[]>
  createChatbot(input: {
    projectId: string
    name: string
    purpose?: string
    capabilities?: Partial<ChatbotCapabilitiesDto>
  }): Promise<ChatbotDto | null>
  getChatbot(id: string): Promise<ChatbotDto | null>
  updateChatbot(
    id: string,
    input: {
      name?: string
      purpose?: string
      capabilities?: Partial<ChatbotCapabilitiesDto>
    },
  ): Promise<ChatbotDto | null>
  updateChatbotRuntimeStatus(id: string, input: { runtimeStatus: ChatbotDto["runtimeStatus"]; lastSyncError?: string | null }): Promise<ChatbotDto | null>
  archiveChatbot(id: string): Promise<ChatbotDto | null>
  unarchiveChatbot(id: string): Promise<ChatbotDto | null>
  deleteChatbot(id: string): Promise<ChatbotDto | null>
  listContent(chatbotId: string): Promise<PlatformContentItemDto[]>
  createContent(chatbotId: string, input: {
    contentType?: PlatformContentType
    title: string
    slug?: string
    body: string
  }): Promise<PlatformContentItemDto | null>
  patchContent(chatbotId: string, contentId: string, input: Partial<{
    contentType: PlatformContentType
    title: string
    slug: string
    body: string
  }>): Promise<PlatformContentItemDto | null>
  publishContent(chatbotId: string, contentId: string): Promise<PlatformPublishResult | null>
  indexPlatformContent(input: PlatformIndexInput): Promise<{ chunkCount: number } | null>
  deleteContent(chatbotId: string, contentId: string): Promise<PlatformContentItemDto | null>
  listKnowledge(chatbotId: string): Promise<PlatformKnowledgeSourceDto[]>
  testMessage(chatbotId: string, input: { message: string; topK?: number; channel?: ConnectorChannel }): Promise<PlatformChatAnswerDto | null>
  listConnectors(chatbotId: string): Promise<{ connectors: ChannelConnectorDto[]; deployment: ChatbotDeploymentDto } | null>
  updateConnectorStatus(chatbotId: string, channel: ConnectorChannel, status: ConnectorStatus): Promise<ChannelConnectorDto | null>
  updateWebsiteAllowedDomains(chatbotId: string, allowedDomains: string[]): Promise<ChatbotDeploymentDto | null>
  updateWebsiteInstallStatus(chatbotId: string, status: ChatbotDeploymentDto["installStatus"]): Promise<ChatbotDeploymentDto | null>
  getDeploymentByPublicKey(publicKey: string): Promise<ChatbotDeploymentDto | null>
  sendWidgetMessage(publicKey: string, input: { message: string; anonymousSessionId?: string }): Promise<PlatformChatAnswerDto | null>
  findActiveChatbotForChannel(channel: Exclude<ConnectorChannel, "website">): Promise<ChatbotDto | null>
  recordChannelExchange(
    chatbotId: string,
    input: {
      channel: Exclude<ConnectorChannel, "website">
      externalUserId: string
      externalMessageId: string
      inboundText: string
      outboundText: string
      actionTrace?: Record<string, unknown>
    },
  ): Promise<void>
  listConversations(chatbotId: string): Promise<PlatformConversationSummaryDto[]>
  recordAgentToolAction(input: { toolName: string; payload: Record<string, unknown>; status?: string }): Promise<PlatformAgentActionDto>
  listAgentActions(): Promise<PlatformAgentActionDto[]>
  close?(): Promise<void>
}

function embeddingSettingsChanged(before: ProjectAiRecord | null | undefined, after: ProjectAiRecord): boolean {
  return (
    (before?.embeddingSource ?? "platform") !== after.embeddingSource ||
    (before?.embeddingProvider ?? null) !== (after.embeddingProvider ?? null) ||
    (before?.embeddingModel ?? null) !== (after.embeddingModel ?? null) ||
    (before?.embeddingDimension ?? null) !== (after.embeddingDimension ?? null) ||
    (before?.embeddingBaseUrl ?? null) !== (after.embeddingBaseUrl ?? null) ||
    (before?.embedderUrl ?? null) !== (after.embedderUrl ?? null)
  )
}

interface ChunkRecord {
  id: string
  knowledgeSourceId: string
  chatbotId: string
  content: string
  title: string
  sourceVersionId: string
  sourceType: PlatformContentType
  embedding: number[]
}

interface PendingIndexRecord {
  chatbotId: string
  contentItemId: string
  sourceVersionId: string
  documentId: string
  knowledgeSourceId: string
  title: string
  body: string
  contentType: PlatformContentType
}

const MIN_VECTOR_RELEVANCE_SCORE = 0.05
const STRONG_VECTOR_RELEVANCE_SCORE = 0.66

function createDefaultProjectAiResolver(
  options: ProductionChatbotStoreOptions,
  loadSecrets: (projectId: string) => Promise<ProjectAiSecrets | null>,
): ProjectAiRuntimeResolver | undefined {
  if (options.projectAiResolver) return options.projectAiResolver
  if (!options.appConfig) return undefined
  return createProjectAiRuntimeResolver(options.appConfig.ai, loadSecrets)
}

function mapMemoryProjectAiRecord(record: ProjectAiRecord): ProjectAiRecord {
  return {
    ...record,
    llmApiKey: record.llmApiKey,
    embeddingApiKey: record.embeddingApiKey,
  }
}

function mapMemorySecrets(record: ProjectAiRecord | undefined, projectId: string): ProjectAiSecrets | null {
  if (!record) return null
  return {
    projectId,
    llmSource: record.llmSource,
    llmApiKey: record.llmApiKey,
    llmBaseUrl: record.llmBaseUrl ?? undefined,
    llmModel: record.llmModel ?? undefined,
    embeddingSource: record.embeddingSource,
    embeddingProvider: record.embeddingProvider ?? undefined,
    embeddingApiKey: record.embeddingApiKey,
    embeddingBaseUrl: record.embeddingBaseUrl ?? undefined,
    embedderUrl: record.embedderUrl ?? undefined,
    embeddingModel: record.embeddingModel ?? undefined,
    embeddingDimension: record.embeddingDimension ?? undefined,
  }
}

export function createInMemoryProductionChatbotStore(options: ProductionChatbotStoreOptions = {}): ProductionChatbotStore {
  const embeddingProvider = options.embeddingProvider ?? createStubEmbeddingProvider()
  const encryptionKey = options.encryptionKey ?? "phase0_dev_only_encryption_key_min_32_chars"
  const appConfig = options.appConfig
  const projects = new Map<string, ProjectDto>()
  const projectAiConfigs = new Map<string, ProjectAiRecord>()
  const chatbots = new Map<string, ChatbotDto>()
  const contentItems = new Map<string, PlatformContentItemDto>()
  const knowledgeSources = new Map<string, PlatformKnowledgeSourceDto>()
  const chunks = new Map<string, ChunkRecord>()
  const connectors = new Map<string, ChannelConnectorDto[]>()
  const deployments = new Map<string, ChatbotDeploymentDto>()
  const conversations = new Map<string, PlatformConversationSummaryDto>()
  const agentActions = new Map<string, PlatformAgentActionDto>()
  const pendingIndexes = new Map<string, PendingIndexRecord>()

  const now = () => new Date().toISOString()
  const projectAiResolver = createDefaultProjectAiResolver(options, async (projectId) => mapMemorySecrets(projectAiConfigs.get(projectId), projectId))
  const runtimeContext = {
    appConfig: appConfig ?? ({ ai: { embeddingDimension: 1024, embeddingProvider: "stub", embeddingModel: "stub/hash-v1", llmBaseUrl: "https://api.openai.com/v1", llmModel: "gpt-4o-mini" } } as AppConfig),
    encryptionKey,
    projectAiResolver,
    defaultEmbeddingProvider: embeddingProvider,
    defaultAnswerProvider: options.answerProvider as RuntimeAnswerProvider | undefined,
    answerProviderPriority: options.answerProviderPriority ?? "project",
  }

  return {
    async listProjects() {
      return [...projects.values()]
        .map((item) => ({
          ...item,
          aiKeys: mapProjectAiKeySummary(projectAiConfigs.get(item.id)),
        }))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },
    async createProject(input) {
      if (input.domain && [...projects.values()].some((project) => project.domain === input.domain)) {
        throw Object.assign(new Error("Project domain already exists"), { code: "23505" })
      }
      const timestamp = now()
      const project: ProjectDto = {
        id: createUuidV7(),
        name: input.name,
        domain: input.domain ?? null,
        status: "active",
        aiKeys: DEFAULT_PROJECT_AI_KEY_SUMMARY,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      projects.set(project.id, project)
      return project
    },
    async getProject(id) {
      return projects.get(id) ?? null
    },
    async archiveProject(id) {
      const existing = projects.get(id)
      if (!existing) return null
      const next: ProjectDto = { ...existing, status: "archived", updatedAt: now() }
      projects.set(id, next)
      return next
    },
    async unarchiveProject(id) {
      const existing = projects.get(id)
      if (!existing) return null
      const next: ProjectDto = { ...existing, status: "active", updatedAt: now() }
      projects.set(id, next)
      return next
    },
    async deleteProject(id) {
      const existing = projects.get(id)
      if (!existing) return null
      projects.delete(id)

      const chatbotIds = new Set([...chatbots.values()].filter((item) => item.projectId === id).map((item) => item.id))
      for (const chatbotId of chatbotIds) {
        chatbots.delete(chatbotId)
        connectors.delete(chatbotId)
        deployments.delete(chatbotId)
      }
      for (const [conversationId, conversation] of conversations) {
        if (chatbotIds.has(conversation.chatbotId)) conversations.delete(conversationId)
      }
      const contentIds = new Set<string>()
      for (const [contentId, item] of contentItems) {
        if (item.projectId === id || chatbotIds.has(item.chatbotId)) {
          contentIds.add(contentId)
          contentItems.delete(contentId)
        }
      }
      const sourceIds = new Set<string>()
      const sourceVersionIds = new Set<string>()
      for (const [sourceId, source] of knowledgeSources) {
        if (contentIds.has(source.contentItemId) || chatbotIds.has(source.chatbotId)) {
          sourceIds.add(sourceId)
          sourceVersionIds.add(source.sourceVersionId)
          knowledgeSources.delete(sourceId)
        }
      }
      for (const [chunkId, chunk] of chunks) {
        if (sourceIds.has(chunk.knowledgeSourceId) || sourceVersionIds.has(chunk.sourceVersionId) || chatbotIds.has(chunk.chatbotId)) chunks.delete(chunkId)
      }
      projectAiConfigs.delete(id)
      return existing
    },
    async getProjectAiConfig(projectId) {
      if (!projects.has(projectId) || !appConfig) return null
      return mapProjectAiConfigDto(projectAiConfigs.get(projectId) ?? null, appConfig, projectId)
    },
    async updateProjectAiConfig(projectId, input) {
      if (!projects.has(projectId) || !appConfig) return null
      const previous = projectAiConfigs.get(projectId) ?? null
      const next = applyProjectAiUpdate(previous, input, projectId, encryptionKey, false)
      projectAiConfigs.set(projectId, mapMemoryProjectAiRecord(next))
      if (embeddingSettingsChanged(previous, next)) {
        const chatbotIds = new Set([...chatbots.values()].filter((item) => item.projectId === projectId).map((item) => item.id))
        const sourceIds = new Set<string>()
        for (const [sourceId, source] of knowledgeSources) {
          if (chatbotIds.has(source.chatbotId)) {
            sourceIds.add(sourceId)
            knowledgeSources.set(sourceId, { ...source, status: "syncing", chunkCount: 0 })
          }
        }
        for (const [chunkId, chunk] of chunks) {
          if (sourceIds.has(chunk.knowledgeSourceId)) chunks.delete(chunkId)
        }
        for (const [chatbotId, item] of chatbots) {
          if (item.projectId === projectId) {
            chatbots.set(chatbotId, {
              ...item,
              runtimeStatus: "syncing",
              lastSyncError: "Embedding preset changed. Reindex published knowledge.",
              updatedAt: now(),
            })
          }
        }
      }
      return mapProjectAiConfigDto(projectAiConfigs.get(projectId) ?? null, appConfig, projectId)
    },
    async getProjectAiSecrets(projectId) {
      if (!projects.has(projectId)) return null
      return mapMemorySecrets(projectAiConfigs.get(projectId), projectId)
    },
    async listChatbots(projectId) {
      return [...chatbots.values()]
        .filter((chatbot) => chatbot.projectId === projectId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },
    async createChatbot(input) {
      if (projects.get(input.projectId)?.status !== "active") return null
      const timestamp = now()
      const chatbotId = createUuidV7()
      const chatbot: ChatbotDto = {
        id: chatbotId,
        projectId: input.projectId,
        name: input.name,
        purpose: input.purpose ?? "",
        capabilities: normalizeCapabilities(input.capabilities),
        status: "active",
        agentKey: createAgentKey(chatbotId),
        knowledgeNamespace: createKnowledgeNamespace(chatbotId),
        runtimeStatus: "provisioning",
        lastIndexedContentVersionId: null,
        lastSyncError: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      chatbots.set(chatbot.id, chatbot)
      connectors.set(chatbot.id, createDefaultConnectors(chatbot.id, timestamp))
      deployments.set(chatbot.id, createWebsiteDeployment(chatbot.id, projects.get(input.projectId)?.domain, timestamp))
      return chatbot
    },
    async getChatbot(id) {
      return chatbots.get(id) ?? null
    },
    async updateChatbot(id, input) {
      const existing = chatbots.get(id)
      if (!existing || existing.status === "archived") return null
      const name = input.name?.trim() ?? existing.name
      if (!name) return null
      const next: ChatbotDto = {
        ...existing,
        name,
        purpose: input.purpose !== undefined ? input.purpose.trim() : existing.purpose,
        capabilities: input.capabilities !== undefined ? normalizeCapabilities(input.capabilities) : existing.capabilities,
        updatedAt: now(),
      }
      chatbots.set(id, next)
      return next
    },
    async updateChatbotRuntimeStatus(id, input) {
      const existing = chatbots.get(id)
      if (!existing) return null
      const next: ChatbotDto = {
        ...existing,
        runtimeStatus: input.runtimeStatus,
        lastSyncError: input.lastSyncError !== undefined ? input.lastSyncError : existing.lastSyncError,
        updatedAt: now(),
      }
      chatbots.set(id, next)
      return next
    },
    async archiveChatbot(id) {
      const existing = chatbots.get(id)
      if (!existing) return null
      const next: ChatbotDto = { ...existing, status: "archived", runtimeStatus: "paused", updatedAt: now() }
      chatbots.set(id, next)
      return next
    },
    async unarchiveChatbot(id) {
      const existing = chatbots.get(id)
      if (!existing) return null
      const next: ChatbotDto = { ...existing, status: "active", runtimeStatus: "provisioning", updatedAt: now() }
      chatbots.set(id, next)
      return next
    },
    async deleteChatbot(id) {
      const existing = chatbots.get(id)
      if (!existing) return null
      chatbots.delete(id)
      connectors.delete(id)
      deployments.delete(id)
      for (const [conversationId, conversation] of conversations) {
        if (conversation.chatbotId === id) conversations.delete(conversationId)
      }
      const contentIds = new Set<string>()
      for (const [contentId, item] of contentItems) {
        if (item.chatbotId === id) {
          contentIds.add(contentId)
          contentItems.delete(contentId)
        }
      }
      const sourceIds = new Set<string>()
      const sourceVersionIds = new Set<string>()
      for (const [sourceId, source] of knowledgeSources) {
        if (source.chatbotId === id || contentIds.has(source.contentItemId)) {
          sourceIds.add(sourceId)
          sourceVersionIds.add(source.sourceVersionId)
          knowledgeSources.delete(sourceId)
        }
      }
      for (const [chunkId, chunk] of chunks) {
        if (chunk.chatbotId === id || sourceIds.has(chunk.knowledgeSourceId) || sourceVersionIds.has(chunk.sourceVersionId)) chunks.delete(chunkId)
      }
      return existing
    },
    async listContent(chatbotId) {
      return [...contentItems.values()]
        .filter((item) => item.chatbotId === chatbotId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },
    async createContent(chatbotId, input) {
      const chatbot = chatbots.get(chatbotId)
      if (!chatbot) return null
      const timestamp = now()
      const item: PlatformContentItemDto = {
        id: createUuidV7(),
        projectId: chatbot.projectId,
        chatbotId,
        contentType: input.contentType ?? "general",
        title: input.title,
        slug: input.slug ?? slugify(input.title),
        body: input.body,
        status: "draft",
        publishedVersionId: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      contentItems.set(item.id, item)
      return item
    },
    async patchContent(chatbotId, contentId, input) {
      const existing = contentItems.get(contentId)
      if (!existing || existing.chatbotId !== chatbotId) return null
      const contentChanged = input.title !== undefined || input.body !== undefined || input.contentType !== undefined
      const next: PlatformContentItemDto = {
        ...existing,
        contentType: input.contentType ?? existing.contentType,
        title: input.title ?? existing.title,
        slug: input.slug ?? existing.slug,
        body: input.body ?? existing.body,
        status: existing.status === "published" && contentChanged ? "draft" : existing.status,
        updatedAt: now(),
      }
      contentItems.set(next.id, next)
      return next
    },
    async publishContent(chatbotId, contentId) {
      const existing = contentItems.get(contentId)
      if (!existing || existing.chatbotId !== chatbotId) return null
      const timestamp = now()
      const versionId = createUuidV7()
      const documentId = createUuidV7()
      const item: PlatformContentItemDto = {
        ...existing,
        status: "published",
        publishedVersionId: versionId,
        updatedAt: timestamp,
      }
      contentItems.set(item.id, item)

      for (const [chunkId, chunk] of chunks) {
        if (chunk.sourceVersionId === versionId) chunks.delete(chunkId)
      }
      for (const [sourceId, source] of knowledgeSources) {
        if (source.chatbotId === chatbotId && source.contentItemId === contentId) knowledgeSources.delete(sourceId)
      }

      const source: PlatformKnowledgeSourceDto = {
        id: createUuidV7(),
        chatbotId,
        contentItemId: item.id,
        sourceVersionId: versionId,
        title: item.title,
        sourceType: item.contentType,
        chunkCount: 0,
        status: "syncing",
        indexedAt: timestamp,
      }
      knowledgeSources.set(source.id, source)
      pendingIndexes.set(documentId, {
        chatbotId,
        contentItemId: item.id,
        sourceVersionId: versionId,
        documentId,
        knowledgeSourceId: source.id,
        title: item.title,
        body: item.body,
        contentType: item.contentType,
      })

      const existingChatbot = chatbots.get(chatbotId)
      if (existingChatbot) {
        chatbots.set(chatbotId, {
          ...existingChatbot,
          runtimeStatus: "syncing",
          lastIndexedContentVersionId: versionId,
          lastSyncError: null,
          updatedAt: timestamp,
        })
      }
      return { item, source, chunkCount: 0, documentId, indexing: true }
    },
    async indexPlatformContent(input) {
      const pending = pendingIndexes.get(input.documentId)
      if (!pending || pending.chatbotId !== input.chatbotId || pending.contentItemId !== input.contentItemId) return null

      const timestamp = now()
      const sourceChunks = chunkContent(pending.title, pending.body)
      const embeddings = await input.embed.embedTexts(sourceChunks.map((chunk) => chunk.content))

      for (const [chunkId, chunk] of chunks) {
        if (chunk.sourceVersionId === pending.sourceVersionId) chunks.delete(chunkId)
      }

      for (const [index, chunk] of sourceChunks.entries()) {
        chunks.set(chunk.id, {
          id: chunk.id,
          knowledgeSourceId: pending.knowledgeSourceId,
          chatbotId: pending.chatbotId,
          content: chunk.content,
          title: pending.title,
          sourceVersionId: pending.sourceVersionId,
          sourceType: pending.contentType,
          embedding: embeddings[index] ?? [],
        })
      }

      const source = knowledgeSources.get(pending.knowledgeSourceId)
      if (source) {
        knowledgeSources.set(source.id, {
          ...source,
          chunkCount: sourceChunks.length,
          status: "indexed",
          indexedAt: timestamp,
        })
      }

      const existingChatbot = chatbots.get(pending.chatbotId)
      if (existingChatbot) {
        chatbots.set(pending.chatbotId, {
          ...existingChatbot,
          runtimeStatus: "live",
          lastIndexedContentVersionId: pending.sourceVersionId,
          lastSyncError: null,
          updatedAt: timestamp,
        })
      }

      pendingIndexes.delete(input.documentId)
      return { chunkCount: sourceChunks.length }
    },
    async deleteContent(chatbotId, contentId) {
      const existing = contentItems.get(contentId)
      if (!existing || existing.chatbotId !== chatbotId) return null

      contentItems.delete(contentId)
      const sourceIds = new Set<string>()
      const sourceVersionIds = new Set<string>()
      for (const [sourceId, source] of knowledgeSources) {
        if (source.chatbotId === chatbotId && source.contentItemId === contentId) {
          sourceIds.add(sourceId)
          sourceVersionIds.add(source.sourceVersionId)
          knowledgeSources.delete(sourceId)
        }
      }
      for (const [chunkId, chunk] of chunks) {
        if (sourceIds.has(chunk.knowledgeSourceId) || sourceVersionIds.has(chunk.sourceVersionId)) chunks.delete(chunkId)
      }
      return existing
    },
    async listKnowledge(chatbotId) {
      return [...knowledgeSources.values()]
        .filter((source) => source.chatbotId === chatbotId)
        .sort((a, b) => b.indexedAt.localeCompare(a.indexedAt))
    },
    async testMessage(chatbotId, input) {
      const chatbot = chatbots.get(chatbotId)
      if (!chatbot) return null
      const topK = input.topK ?? 5
      const runtime = await resolveProjectRuntimeProviders(chatbot.projectId, runtimeContext)
      const indexedSourceIds = new Set(
        [...knowledgeSources.values()]
          .filter((source) => source.chatbotId === chatbotId && source.status === "indexed")
          .map((source) => source.id),
      )
      const [queryEmbedding] = await runtime.embeddingProvider.embedTexts([input.message])
      const indexedChunks = [...chunks.values()].filter((chunk) => chunk.chatbotId === chatbotId && indexedSourceIds.has(chunk.knowledgeSourceId))
      const sources = retrievePlatformSources(indexedChunks, input.message, queryEmbedding, topK)
      return composePlatformAnswer({
        message: input.message,
        sources,
        topK,
        channel: input.channel ?? "website",
        chatbot,
        chatbotId,
        answerProvider: runtime.answerProvider as PlatformAnswerProvider | undefined,
        embeddingModel: runtime.embeddingProvider.model,
        llmConfig: runtime.llmConfig,
      })
    },
    async listConnectors(chatbotId) {
      const deployment = deployments.get(chatbotId)
      const chatbotConnectors = connectors.get(chatbotId)
      if (!deployment || !chatbotConnectors) return null
      return { connectors: chatbotConnectors, deployment }
    },
    async updateConnectorStatus(chatbotId, channel, status) {
      const chatbotConnectors = connectors.get(chatbotId)
      if (!chatbotConnectors) return null
      const existing = chatbotConnectors.find((connector) => connector.channel === channel)
      if (!existing) return null
      const next = { ...existing, status, updatedAt: now() }
      connectors.set(chatbotId, chatbotConnectors.map((connector) => connector.id === next.id ? next : connector))
      return next
    },
    async getDeploymentByPublicKey(publicKey) {
      return [...deployments.values()].find((deployment) => deployment.publicKey === publicKey) ?? null
    },
    async updateWebsiteAllowedDomains(chatbotId, allowedDomains) {
      const existing = deployments.get(chatbotId)
      if (!existing) return null
      const next = {
        ...existing,
        allowedDomains,
        installStatus: "unverified" as const,
        updatedAt: now(),
      }
      deployments.set(chatbotId, next)
      return next
    },
    async updateWebsiteInstallStatus(chatbotId, status) {
      const existing = deployments.get(chatbotId)
      if (!existing) return null
      const next = { ...existing, installStatus: status, updatedAt: now() }
      deployments.set(chatbotId, next)
      return next
    },
    async sendWidgetMessage(publicKey, input) {
      const deployment = [...deployments.values()].find((candidate) => candidate.publicKey === publicKey)
      if (!deployment) return null
      const answer = await this.testMessage(deployment.chatbotId, { message: input.message, channel: "website" })
      if (!answer) return null
      const timestamp = now()
      const conversationId = `${deployment.chatbotId}:${input.anonymousSessionId ?? "anonymous"}`
      const existing = conversations.get(conversationId)
      conversations.set(conversationId, {
        id: existing?.id ?? createUuidV7(),
        chatbotId: deployment.chatbotId,
        channel: "website",
        externalThreadId: input.anonymousSessionId ?? null,
        status: "open",
        messageCount: (existing?.messageCount ?? 0) + 2,
        lastUserMessage: input.message,
        lastAssistantMessage: answer.answer,
        lastMessageAt: timestamp,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      })
      return answer
    },
    async findActiveChatbotForChannel(channel) {
      for (const [chatbotId, chatbotConnectors] of connectors) {
        const connector = chatbotConnectors.find((item) => item.channel === channel && item.status === "active")
        if (!connector) continue
        const chatbot = chatbots.get(chatbotId)
        if (chatbot && chatbot.status !== "archived") return chatbot
      }
      return null
    },
    async recordChannelExchange(chatbotId, input) {
      const timestamp = now()
      const conversationId = `${chatbotId}:${input.channel}:${input.externalUserId}`
      const existing = conversations.get(conversationId)
      conversations.set(conversationId, {
        id: existing?.id ?? createUuidV7(),
        chatbotId,
        channel: input.channel,
        externalThreadId: input.externalUserId,
        status: "open",
        messageCount: (existing?.messageCount ?? 0) + 2,
        lastUserMessage: input.inboundText,
        lastAssistantMessage: input.outboundText,
        lastMessageAt: timestamp,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      })
    },
    async listConversations(chatbotId) {
      return [...conversations.values()]
        .filter((conversation) => conversation.chatbotId === chatbotId)
        .sort((a, b) => (b.lastMessageAt ?? b.updatedAt).localeCompare(a.lastMessageAt ?? a.updatedAt))
    },
    async recordAgentToolAction(input) {
      const action: PlatformAgentActionDto = {
        id: createUuidV7(),
        toolName: input.toolName,
        status: input.status ?? "recorded_for_follow_up",
        payload: input.payload,
        createdAt: now(),
      }
      agentActions.set(action.id, action)
      return action
    },
    async listAgentActions() {
      return [...agentActions.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },
  }
}

export function createDrizzleProductionChatbotStore(db: AppDb, pool: Pool, options: ProductionChatbotStoreOptions = {}): ProductionChatbotStore {
  const embeddingProvider = options.embeddingProvider ?? createStubEmbeddingProvider()
  const encryptionKey = options.encryptionKey ?? "phase0_dev_only_encryption_key_min_32_chars"
  const appConfig = options.appConfig
  let tenantIdCache: string | null = null

  async function ensureTenantId() {
    if (tenantIdCache) return tenantIdCache
    let tenantRow = await db.query.tenant.findFirst({ where: eq(tenant.domain, DEFAULT_TENANT_DOMAIN) })
    if (!tenantRow) {
      const [created] = await db
        .insert(tenant)
        .values({ id: createUuidV7(), name: "Khanect Omni Realty Dev", domain: DEFAULT_TENANT_DOMAIN })
        .returning()
      tenantRow = created
    }
    tenantIdCache = tenantRow.id
    return tenantIdCache
  }

  const projectAiResolver = createDefaultProjectAiResolver(options, async (projectId) => {
    const tenantId = await ensureTenantId()
    return loadProjectAiSecretsFromDb(db, tenantId, projectId, encryptionKey)
  })
  const runtimeContext = {
    appConfig: appConfig ?? ({ ai: { embeddingDimension: 1024, embeddingProvider: "stub", embeddingModel: "stub/hash-v1", llmBaseUrl: "https://api.openai.com/v1", llmModel: "gpt-4o-mini" } } as AppConfig),
    encryptionKey,
    projectAiResolver,
    defaultEmbeddingProvider: embeddingProvider,
    defaultAnswerProvider: options.answerProvider as RuntimeAnswerProvider | undefined,
    answerProviderPriority: options.answerProviderPriority ?? "project",
  }

  return {
    async listProjects() {
      const tenantId = await ensureTenantId()
      const rows = await db.query.project.findMany({ where: eq(project.tenantId, tenantId), orderBy: [desc(project.updatedAt)] })
      const aiRows = await db.query.projectAiConfig.findMany({ where: eq(projectAiConfig.tenantId, tenantId) })
      const aiByProjectId = new Map(aiRows.map((row) => [row.projectId, mapRowToProjectAiRecord(row)]))
      return rows.map((row) => ({
        ...mapProject(row),
        aiKeys: mapProjectAiKeySummary(aiByProjectId.get(row.id)),
      }))
    },
    async createProject(input) {
      const tenantId = await ensureTenantId()
      const [row] = await db
        .insert(project)
        .values({ id: createUuidV7(), tenantId, name: input.name, domain: input.domain ?? null })
        .returning()
      return mapProject(row)
    },
    async getProject(id) {
      const tenantId = await ensureTenantId()
      const row = await db.query.project.findFirst({ where: and(eq(project.tenantId, tenantId), eq(project.id, id)) })
      return row ? mapProject(row) : null
    },
    async archiveProject(id) {
      const tenantId = await ensureTenantId()
      const [row] = await db
        .update(project)
        .set({ status: "archived", updatedAt: new Date() })
        .where(and(eq(project.tenantId, tenantId), eq(project.id, id)))
        .returning()
      return row ? mapProject(row) : null
    },
    async unarchiveProject(id) {
      const tenantId = await ensureTenantId()
      const [row] = await db
        .update(project)
        .set({ status: "active", updatedAt: new Date() })
        .where(and(eq(project.tenantId, tenantId), eq(project.id, id)))
        .returning()
      return row ? mapProject(row) : null
    },
    async deleteProject(id) {
      const tenantId = await ensureTenantId()
      const row = await db.query.project.findFirst({ where: and(eq(project.tenantId, tenantId), eq(project.id, id)) })
      if (!row) return null
      const mapped = mapProject(row)
      const contentRows = await db
        .select({ id: contentItem.id })
        .from(contentItem)
        .where(and(eq(contentItem.tenantId, tenantId), sql`${contentItem.metadata}->>'projectId' = ${id}`))
      for (const contentRow of contentRows) {
        await db
          .delete(contentVersion)
          .where(and(eq(contentVersion.tenantId, tenantId), eq(contentVersion.entityType, "content_item"), eq(contentVersion.entityId, contentRow.id)))
      }
      await db
        .delete(contentItem)
        .where(and(eq(contentItem.tenantId, tenantId), sql`${contentItem.metadata}->>'projectId' = ${id}`))
      await deleteProjectAiRecord(db, tenantId, id, pool)
      await db
        .delete(project)
        .where(and(eq(project.tenantId, tenantId), eq(project.id, id)))
      return mapped
    },
    async getProjectAiConfig(projectId) {
      const tenantId = await ensureTenantId()
      const projectRow = await db.query.project.findFirst({ where: and(eq(project.tenantId, tenantId), eq(project.id, projectId)) })
      if (!projectRow || !appConfig) return null
      const row = await db.query.projectAiConfig.findFirst({
        where: and(eq(projectAiConfig.tenantId, tenantId), eq(projectAiConfig.projectId, projectId)),
      })
      return mapProjectAiConfigDto(row ? mapRowToProjectAiRecord(row) : null, appConfig, projectId)
    },
    async updateProjectAiConfig(projectId, input) {
      const tenantId = await ensureTenantId()
      const projectRow = await db.query.project.findFirst({ where: and(eq(project.tenantId, tenantId), eq(project.id, projectId)) })
      if (!projectRow || !appConfig) return null
      const existingRow = await db.query.projectAiConfig.findFirst({
        where: and(eq(projectAiConfig.tenantId, tenantId), eq(projectAiConfig.projectId, projectId)),
      })
      const previous = existingRow ? mapRowToProjectAiRecord(existingRow) : null
      const next = applyProjectAiUpdate(previous, input, projectId, encryptionKey)
      const saved = await upsertProjectAiRecord(db, tenantId, next)
      if (embeddingSettingsChanged(previous, saved)) {
        await pool.query(
          `delete from rag_chunk c
             using chatbot_knowledge_source ks
            where ks.tenant_id = $1
              and ks.project_id = $2
              and c.tenant_id = ks.tenant_id
              and c.source_version_id = ks.source_version_id`,
          [tenantId, projectId],
        )
        await db
          .update(chatbotKnowledgeSource)
          .set({ status: "syncing", updatedAt: new Date() })
          .where(and(eq(chatbotKnowledgeSource.tenantId, tenantId), eq(chatbotKnowledgeSource.projectId, projectId)))
        await db
          .update(chatbot)
          .set({
            runtimeStatus: "syncing",
            lastSyncError: "Embedding preset changed. Reindex published knowledge.",
            updatedAt: new Date(),
          })
          .where(and(eq(chatbot.tenantId, tenantId), eq(chatbot.projectId, projectId)))
      }
      return mapProjectAiConfigDto(saved, appConfig, projectId)
    },
    async getProjectAiSecrets(projectId) {
      const tenantId = await ensureTenantId()
      const projectRow = await db.query.project.findFirst({ where: and(eq(project.tenantId, tenantId), eq(project.id, projectId)) })
      if (!projectRow) return null
      return loadProjectAiSecretsFromDb(db, tenantId, projectId, encryptionKey)
    },
    async listChatbots(projectId) {
      const tenantId = await ensureTenantId()
      const rows = await db.query.chatbot.findMany({
        where: and(eq(chatbot.tenantId, tenantId), eq(chatbot.projectId, projectId)),
        orderBy: [desc(chatbot.updatedAt)],
      })
      return rows.map(mapChatbot)
    },
    async createChatbot(input) {
      const tenantId = await ensureTenantId()
      const projectRow = await db.query.project.findFirst({ where: and(eq(project.tenantId, tenantId), eq(project.id, input.projectId)) })
      if (!projectRow || projectRow.status !== "active") return null
      const timestamp = new Date()
      const chatbotId = createUuidV7()
      const [row] = await db
        .insert(chatbot)
        .values({
          id: chatbotId,
          tenantId,
          projectId: input.projectId,
          name: input.name,
          purpose: input.purpose ?? "",
          capabilities: normalizeCapabilities(input.capabilities),
          status: "active",
          agentKey: createAgentKey(chatbotId),
          knowledgeNamespace: createKnowledgeNamespace(chatbotId),
          runtimeStatus: "provisioning",
        })
        .returning()
      for (const connector of createDefaultConnectors(row.id, timestamp.toISOString())) {
        await db.insert(channelConnector).values({
          id: connector.id,
          tenantId,
          projectId: row.projectId,
          chatbotId: row.id,
          channel: connector.channel,
          status: connector.status,
          displayName: connector.displayName,
          config: connector.config,
        })
      }
      const deployment = createWebsiteDeployment(row.id, projectRow.domain, timestamp.toISOString())
      await db.insert(chatbotDeployment).values({
        id: deployment.id,
        tenantId,
        projectId: row.projectId,
        chatbotId: row.id,
        channel: "website",
        publicKey: deployment.publicKey,
        allowedDomains: deployment.allowedDomains,
        installStatus: deployment.installStatus,
        config: {},
      })
      return mapChatbot(row)
    },
    async getChatbot(id) {
      const tenantId = await ensureTenantId()
      const row = await db.query.chatbot.findFirst({ where: and(eq(chatbot.tenantId, tenantId), eq(chatbot.id, id)) })
      return row ? mapChatbot(row) : null
    },
    async updateChatbot(id, input) {
      const tenantId = await ensureTenantId()
      const existing = await db.query.chatbot.findFirst({ where: and(eq(chatbot.tenantId, tenantId), eq(chatbot.id, id)) })
      if (!existing || existing.status === "archived") return null
      const name = input.name?.trim() ?? existing.name
      if (!name) return null
      const [row] = await db
        .update(chatbot)
        .set({
          name,
          purpose: input.purpose !== undefined ? input.purpose.trim() : existing.purpose,
          capabilities: input.capabilities !== undefined ? normalizeCapabilities(input.capabilities) : existing.capabilities,
          updatedAt: new Date(),
        })
        .where(and(eq(chatbot.tenantId, tenantId), eq(chatbot.id, id)))
        .returning()
      return row ? mapChatbot(row) : null
    },
    async updateChatbotRuntimeStatus(id, input) {
      const tenantId = await ensureTenantId()
      const [row] = await db
        .update(chatbot)
        .set({
          runtimeStatus: input.runtimeStatus,
          lastSyncError: input.lastSyncError !== undefined ? input.lastSyncError : undefined,
          updatedAt: new Date(),
        })
        .where(and(eq(chatbot.tenantId, tenantId), eq(chatbot.id, id)))
        .returning()
      return row ? mapChatbot(row) : null
    },
    async archiveChatbot(id) {
      const tenantId = await ensureTenantId()
      const [row] = await db
        .update(chatbot)
        .set({ status: "archived", runtimeStatus: "paused", updatedAt: new Date() })
        .where(and(eq(chatbot.tenantId, tenantId), eq(chatbot.id, id)))
        .returning()
      return row ? mapChatbot(row) : null
    },
    async unarchiveChatbot(id) {
      const tenantId = await ensureTenantId()
      const [row] = await db
        .update(chatbot)
        .set({ status: "active", runtimeStatus: "provisioning", updatedAt: new Date() })
        .where(and(eq(chatbot.tenantId, tenantId), eq(chatbot.id, id)))
        .returning()
      return row ? mapChatbot(row) : null
    },
    async deleteChatbot(id) {
      const tenantId = await ensureTenantId()
      const row = await db.query.chatbot.findFirst({ where: and(eq(chatbot.tenantId, tenantId), eq(chatbot.id, id)) })
      if (!row) return null
      const mapped = mapChatbot(row)
      const contentRows = await db
        .select({ id: contentItem.id })
        .from(contentItem)
        .where(and(eq(contentItem.tenantId, tenantId), sql`${contentItem.metadata}->>'chatbotId' = ${id}`))
      for (const contentRow of contentRows) {
        await db
          .delete(contentVersion)
          .where(and(eq(contentVersion.tenantId, tenantId), eq(contentVersion.entityType, "content_item"), eq(contentVersion.entityId, contentRow.id)))
      }
      await db
        .delete(contentItem)
        .where(and(eq(contentItem.tenantId, tenantId), sql`${contentItem.metadata}->>'chatbotId' = ${id}`))
      await db
        .delete(chatbot)
        .where(and(eq(chatbot.tenantId, tenantId), eq(chatbot.id, id)))
      return mapped
    },
    async listContent(chatbotId) {
      const tenantId = await ensureTenantId()
      const rows = await db
        .select()
        .from(contentItem)
        .where(and(eq(contentItem.tenantId, tenantId), sql`${contentItem.metadata}->>'chatbotId' = ${chatbotId}`))
        .orderBy(desc(contentItem.updatedAt))
      return rows.map((item) => mapContent(item, chatbotId))
    },
    async createContent(chatbotId, input) {
      const tenantId = await ensureTenantId()
      const chatbotRow = await db.query.chatbot.findFirst({ where: and(eq(chatbot.tenantId, tenantId), eq(chatbot.id, chatbotId)) })
      if (!chatbotRow) return null
      const itemId = createUuidV7()
      const [row] = await db
        .insert(contentItem)
        .values({
          id: itemId,
          tenantId,
          contentType: input.contentType ?? "general",
          title: input.title,
          slug: `${input.slug ?? slugify(input.title)}-${itemId.slice(-6)}`,
          body: input.body,
          status: "draft",
          metadata: { projectId: chatbotRow.projectId, chatbotId },
        })
        .returning()
      return mapContent(row, chatbotId)
    },
    async patchContent(chatbotId, contentId, input) {
      const tenantId = await ensureTenantId()
      const existing = await db.query.contentItem.findFirst({ where: and(eq(contentItem.tenantId, tenantId), eq(contentItem.id, contentId)) })
      if (!existing) return null
      const contentChanged = input.title !== undefined || input.body !== undefined || input.contentType !== undefined
      const [row] = await db
        .update(contentItem)
        .set({
          contentType: input.contentType,
          title: input.title,
          slug: input.slug,
          body: input.body,
          status: existing.status === "published" && contentChanged ? "draft" : existing.status,
          updatedAt: new Date(),
        })
        .where(and(eq(contentItem.tenantId, tenantId), eq(contentItem.id, contentId)))
        .returning()
      return row ? mapContent(row, chatbotId) : null
    },
    async publishContent(chatbotId, contentId) {
      const tenantId = await ensureTenantId()
      const chatbotRow = await db.query.chatbot.findFirst({ where: and(eq(chatbot.tenantId, tenantId), eq(chatbot.id, chatbotId)) })
      const item = await db.query.contentItem.findFirst({ where: and(eq(contentItem.tenantId, tenantId), eq(contentItem.id, contentId)) })
      if (!chatbotRow || !item) return null
      const [{ maxVersion }] = await db
        .select({ maxVersion: sql<number>`coalesce(max(${contentVersion.versionNumber}), 0)` })
        .from(contentVersion)
        .where(and(eq(contentVersion.tenantId, tenantId), eq(contentVersion.entityId, contentId)))
      const versionId = createUuidV7()
      const publishedAt = new Date()
      await db.insert(contentVersion).values({
        id: versionId,
        tenantId,
        entityType: "content_item",
        entityId: item.id,
        versionNumber: Number(maxVersion) + 1,
        state: "published",
        snapshotJson: { ...mapContent(item, chatbotId), status: "published", publishedVersionId: versionId },
        publishedAt,
      })
      const [published] = await db
        .update(contentItem)
        .set({ status: "published", publishedVersionId: versionId, updatedAt: publishedAt })
        .where(and(eq(contentItem.tenantId, tenantId), eq(contentItem.id, contentId)))
        .returning()

      const documentId = createUuidV7()
      await db.insert(ragDocument).values({
        id: documentId,
        tenantId,
        sourceType: published.contentType,
        sourceId: published.id,
        sourceVersionId: versionId,
        title: published.title,
        status: "indexing",
        chunkCount: 0,
        publishedAt,
      })
      await db
        .delete(chatbotKnowledgeSource)
        .where(and(eq(chatbotKnowledgeSource.tenantId, tenantId), eq(chatbotKnowledgeSource.chatbotId, chatbotId), eq(chatbotKnowledgeSource.contentItemId, contentId)))
      const [sourceRow] = await db
        .insert(chatbotKnowledgeSource)
        .values({
          id: createUuidV7(),
          tenantId,
          projectId: chatbotRow.projectId,
          chatbotId,
          contentItemId: published.id,
          sourceVersionId: versionId,
          status: "syncing",
        })
        .returning()
      await db
        .update(chatbot)
        .set({
          runtimeStatus: "syncing",
          lastIndexedContentVersionId: versionId,
          lastSyncError: null,
          updatedAt: publishedAt,
        })
        .where(and(eq(chatbot.tenantId, tenantId), eq(chatbot.id, chatbotId)))
      return {
        item: mapContent(published, chatbotId),
        source: mapKnowledgeSource(sourceRow, published.title, published.contentType, 0, publishedAt),
        chunkCount: 0,
        documentId,
        indexing: true,
      }
    },
    async indexPlatformContent(input) {
      const tenantId = await ensureTenantId()
      const chatbotRow = await db.query.chatbot.findFirst({ where: and(eq(chatbot.tenantId, tenantId), eq(chatbot.id, input.chatbotId)) })
      const item = await db.query.contentItem.findFirst({ where: and(eq(contentItem.tenantId, tenantId), eq(contentItem.id, input.contentItemId)) })
      const document = await db.query.ragDocument.findFirst({
        where: and(eq(ragDocument.tenantId, tenantId), eq(ragDocument.id, input.documentId), eq(ragDocument.sourceVersionId, input.sourceVersionId)),
      })
      if (!chatbotRow || !item || !document) return null

      const indexedAt = new Date()
      try {
        const sourceChunks = chunkContent(item.title, item.body)
        const embeddings = await input.embed.embedTexts(sourceChunks.map((chunk) => chunk.content))

        await db.delete(ragChunk).where(and(eq(ragChunk.tenantId, tenantId), eq(ragChunk.documentId, input.documentId)))
        for (const [index, chunk] of sourceChunks.entries()) {
          await db.insert(ragChunk).values({
            id: chunk.id,
            tenantId,
            documentId: input.documentId,
            sourceVersionId: input.sourceVersionId,
            chunkIndex: index,
            section: chunk.section,
            content: chunk.content,
            metadata: chunk.metadata,
            ...embeddingColumnValues(embeddings[index] ?? [], input.embed.dimension),
            embeddingModel: input.embed.model,
            embeddingDimension: input.embed.dimension,
          })
        }

        await db
          .update(ragDocument)
          .set({ status: "indexed", chunkCount: sourceChunks.length, indexedAt, updatedAt: indexedAt })
          .where(and(eq(ragDocument.tenantId, tenantId), eq(ragDocument.id, input.documentId)))
        await db
          .update(chatbotKnowledgeSource)
          .set({ status: "indexed", updatedAt: indexedAt })
          .where(
            and(
              eq(chatbotKnowledgeSource.tenantId, tenantId),
              eq(chatbotKnowledgeSource.chatbotId, input.chatbotId),
              eq(chatbotKnowledgeSource.contentItemId, input.contentItemId),
              eq(chatbotKnowledgeSource.sourceVersionId, input.sourceVersionId),
            ),
          )
        await db
          .update(chatbot)
          .set({
            runtimeStatus: "live",
            lastIndexedContentVersionId: input.sourceVersionId,
            lastSyncError: null,
            updatedAt: indexedAt,
          })
          .where(and(eq(chatbot.tenantId, tenantId), eq(chatbot.id, input.chatbotId)))

        return { chunkCount: sourceChunks.length }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        await db
          .update(chatbot)
          .set({ runtimeStatus: "error", lastSyncError: message, updatedAt: indexedAt })
          .where(and(eq(chatbot.tenantId, tenantId), eq(chatbot.id, input.chatbotId)))
        await db
          .update(ragDocument)
          .set({ status: "failed", updatedAt: indexedAt })
          .where(and(eq(ragDocument.tenantId, tenantId), eq(ragDocument.id, input.documentId)))
        await db
          .update(chatbotKnowledgeSource)
          .set({ status: "failed", updatedAt: indexedAt })
          .where(
            and(
              eq(chatbotKnowledgeSource.tenantId, tenantId),
              eq(chatbotKnowledgeSource.chatbotId, input.chatbotId),
              eq(chatbotKnowledgeSource.contentItemId, input.contentItemId),
            ),
          )
        throw error instanceof Error ? error : new Error(message)
      }
    },
    async deleteContent(chatbotId, contentId) {
      const tenantId = await ensureTenantId()
      const existing = await db.query.contentItem.findFirst({ where: and(eq(contentItem.tenantId, tenantId), eq(contentItem.id, contentId)) })
      if (!existing) return null
      const mapped = mapContent(existing, chatbotId)
      if (mapped.chatbotId !== chatbotId) return null

      await db
        .delete(contentVersion)
        .where(and(eq(contentVersion.tenantId, tenantId), eq(contentVersion.entityType, "content_item"), eq(contentVersion.entityId, contentId)))
      await db
        .delete(contentItem)
        .where(and(eq(contentItem.tenantId, tenantId), eq(contentItem.id, contentId)))
      return mapped
    },
    async listKnowledge(chatbotId) {
      const tenantId = await ensureTenantId()
      const result = await pool.query<{
        id: string
        content_item_id: string
        source_version_id: string
        title: string
        source_type: PlatformContentType
        chunk_count: number
        status: KnowledgeSyncStatus
        indexed_at: string
      }>(
        `select ks.id,
                ks.content_item_id,
                ks.source_version_id,
                coalesce(d.title, ci.title) as title,
                coalesce(d.source_type, ci.content_type) as source_type,
                coalesce(d.chunk_count, 0) as chunk_count,
                ks.status,
                coalesce(d.indexed_at, ks.updated_at) as indexed_at
           from chatbot_knowledge_source ks
           join content_item ci on ci.id = ks.content_item_id
           left join rag_document d on d.source_version_id = ks.source_version_id
          where ks.tenant_id = $1 and ks.chatbot_id = $2
          order by indexed_at desc`,
        [tenantId, chatbotId],
      )
      return result.rows.map((row) => ({
        id: row.id,
        chatbotId,
        contentItemId: row.content_item_id,
        sourceVersionId: row.source_version_id,
        title: row.title,
        sourceType: row.source_type,
        chunkCount: Number(row.chunk_count),
        status: row.status,
        indexedAt: new Date(row.indexed_at).toISOString(),
      }))
    },
    async testMessage(chatbotId, input) {
      const tenantId = await ensureTenantId()
      const chatbotRow = await db.query.chatbot.findFirst({ where: and(eq(chatbot.tenantId, tenantId), eq(chatbot.id, chatbotId)) })
      if (!chatbotRow) return null
      const topK = input.topK ?? 5
      const runtime = await resolveProjectRuntimeProviders(chatbotRow.projectId, runtimeContext)
      const [queryEmbedding] = await runtime.embeddingProvider.embedTexts([input.message])
      const queryVector = serializePgVector(queryEmbedding)
      const vectorColumn = vectorDistanceSql(runtime.embeddingProvider.dimension)
      const vectorResult = await pool.query<{
        chunk_id: string
        knowledge_source_id: string
        title: string
        content: string
        source_version_id: string
        source_type: PlatformContentType
        distance: string | number
      }>(
        `select c.id as chunk_id,
                ks.id as knowledge_source_id,
                d.title,
                c.content,
                c.source_version_id,
                d.source_type,
                ${vectorColumn.column} <=> $3::vector as distance
           from chatbot_knowledge_source ks
           join rag_document d on d.source_version_id = ks.source_version_id
           join rag_chunk c on c.source_version_id = ks.source_version_id
          where ks.tenant_id = $1
            and ks.chatbot_id = $2
            and ks.status = 'indexed'
            and d.status = 'indexed'
            and c.embedding_dimension = $5
            and ${vectorColumn.condition}
          order by ${vectorColumn.column} <=> $3::vector
          limit $4`,
        [tenantId, chatbotId, queryVector, topK, runtime.embeddingProvider.dimension],
      )
      const vectorSources: PlatformSourceDto[] = vectorResult.rows
        .map((row) => ({
          chunkId: row.chunk_id,
          knowledgeSourceId: row.knowledge_source_id,
          title: row.title,
          excerpt: excerpt(row.content),
          score: Number((1 - Number(row.distance)).toFixed(6)),
          sourceType: row.source_type,
        }))
        .filter((source) => source.score >= MIN_VECTOR_RELEVANCE_SCORE)

      let sources = vectorSources
      if (sources.length === 0) {
        const keywordResult = await pool.query<{
          chunk_id: string
          knowledge_source_id: string
          title: string
          content: string
          source_version_id: string
          source_type: PlatformContentType
        }>(
          `select c.id as chunk_id,
                  ks.id as knowledge_source_id,
                  d.title,
                  c.content,
                  c.source_version_id,
                  d.source_type
             from chatbot_knowledge_source ks
             join rag_document d on d.source_version_id = ks.source_version_id
             join rag_chunk c on c.source_version_id = ks.source_version_id
            where ks.tenant_id = $1
              and ks.chatbot_id = $2
              and ks.status = 'indexed'
              and d.status = 'indexed'
              and c.embedding_dimension = $3`,
          [tenantId, chatbotId, runtime.embeddingProvider.dimension],
        )
        sources = searchChunksByKeywords(
          keywordResult.rows.map((row) => ({
            id: row.chunk_id,
            knowledgeSourceId: row.knowledge_source_id,
            chatbotId,
            content: row.content,
            title: row.title,
            sourceVersionId: row.source_version_id,
            sourceType: row.source_type,
            embedding: queryEmbedding,
          })),
          input.message,
          topK,
        )
      }
      const chatbotDto = mapChatbot(chatbotRow)
      return composePlatformAnswer({
        message: input.message,
        sources,
        topK,
        channel: input.channel ?? "website",
        chatbot: chatbotDto,
        chatbotId,
        answerProvider: runtime.answerProvider as PlatformAnswerProvider | undefined,
        embeddingModel: runtime.embeddingProvider.model,
        llmConfig: runtime.llmConfig,
      })
    },
    async listConnectors(chatbotId) {
      const tenantId = await ensureTenantId()
      const connectorRows = await db.query.channelConnector.findMany({ where: and(eq(channelConnector.tenantId, tenantId), eq(channelConnector.chatbotId, chatbotId)) })
      const deploymentRow = await db.query.chatbotDeployment.findFirst({ where: and(eq(chatbotDeployment.tenantId, tenantId), eq(chatbotDeployment.chatbotId, chatbotId), eq(chatbotDeployment.channel, "website")) })
      if (!deploymentRow) return null
      return { connectors: connectorRows.map(mapConnector), deployment: mapDeployment(deploymentRow) }
    },
    async updateConnectorStatus(chatbotId, channel, status) {
      const tenantId = await ensureTenantId()
      const [row] = await db
        .update(channelConnector)
        .set({ status, updatedAt: new Date() })
        .where(and(eq(channelConnector.tenantId, tenantId), eq(channelConnector.chatbotId, chatbotId), eq(channelConnector.channel, channel)))
        .returning()
      return row ? mapConnector(row) : null
    },
    async getDeploymentByPublicKey(publicKey) {
      const tenantId = await ensureTenantId()
      const row = await db.query.chatbotDeployment.findFirst({ where: and(eq(chatbotDeployment.tenantId, tenantId), eq(chatbotDeployment.publicKey, publicKey)) })
      return row ? mapDeployment(row) : null
    },
    async updateWebsiteAllowedDomains(chatbotId, allowedDomains) {
      const tenantId = await ensureTenantId()
      const [row] = await db
        .update(chatbotDeployment)
        .set({ allowedDomains, installStatus: "unverified", updatedAt: new Date() })
        .where(and(eq(chatbotDeployment.tenantId, tenantId), eq(chatbotDeployment.chatbotId, chatbotId), eq(chatbotDeployment.channel, "website")))
        .returning()
      return row ? mapDeployment(row) : null
    },
    async updateWebsiteInstallStatus(chatbotId, status) {
      const tenantId = await ensureTenantId()
      const [row] = await db
        .update(chatbotDeployment)
        .set({ installStatus: status, updatedAt: new Date() })
        .where(and(eq(chatbotDeployment.tenantId, tenantId), eq(chatbotDeployment.chatbotId, chatbotId), eq(chatbotDeployment.channel, "website")))
        .returning()
      return row ? mapDeployment(row) : null
    },
    async sendWidgetMessage(publicKey, input) {
      const tenantId = await ensureTenantId()
      const deploymentRow = await db.query.chatbotDeployment.findFirst({ where: and(eq(chatbotDeployment.tenantId, tenantId), eq(chatbotDeployment.publicKey, publicKey)) })
      if (!deploymentRow) return null
      const answer = await this.testMessage(deploymentRow.chatbotId, { message: input.message, channel: "website" })
      if (!answer) return null
      const timestamp = new Date()
      const externalThreadId = input.anonymousSessionId ?? "anonymous"
      let conversation = await db.query.channelConversation.findFirst({
        where: and(
          eq(channelConversation.tenantId, tenantId),
          eq(channelConversation.chatbotId, deploymentRow.chatbotId),
          eq(channelConversation.channel, "website"),
          eq(channelConversation.externalThreadId, externalThreadId),
        ),
      })
      if (!conversation) {
        const [created] = await db
          .insert(channelConversation)
          .values({
            id: createUuidV7(),
            tenantId,
            projectId: deploymentRow.projectId,
            chatbotId: deploymentRow.chatbotId,
            channel: "website",
            externalThreadId,
            status: "open",
            actionTrace: answer.actionTrace,
            lastMessageAt: timestamp,
          })
          .returning()
        conversation = created
      }
      await db.insert(channelMessage).values([
        {
          id: createUuidV7(),
          tenantId,
          conversationId: conversation.id,
          direction: "inbound",
          messageType: "text",
          content: input.message,
          sourceIds: [],
          actionTrace: {},
        },
        {
          id: createUuidV7(),
          tenantId,
          conversationId: conversation.id,
          direction: "outbound",
          messageType: "text",
          content: answer.answer,
          sourceIds: answer.sources.map((source) => source.chunkId),
          actionTrace: answer.actionTrace,
        },
      ])
      await db
        .update(channelConversation)
        .set({ actionTrace: answer.actionTrace, lastMessageAt: timestamp, updatedAt: timestamp })
        .where(and(eq(channelConversation.tenantId, tenantId), eq(channelConversation.id, conversation.id)))
      return answer
    },
    async findActiveChatbotForChannel(channel) {
      const tenantId = await ensureTenantId()
      const connectorRow = await db.query.channelConnector.findFirst({
        where: and(eq(channelConnector.tenantId, tenantId), eq(channelConnector.channel, channel), eq(channelConnector.status, "active")),
      })
      if (!connectorRow) return null
      const chatbotRow = await db.query.chatbot.findFirst({
        where: and(eq(chatbot.tenantId, tenantId), eq(chatbot.id, connectorRow.chatbotId)),
      })
      return chatbotRow && chatbotRow.status !== "archived" ? mapChatbot(chatbotRow) : null
    },
    async recordChannelExchange(chatbotId, input) {
      const tenantId = await ensureTenantId()
      const chatbotRow = await db.query.chatbot.findFirst({
        where: and(eq(chatbot.tenantId, tenantId), eq(chatbot.id, chatbotId)),
      })
      if (!chatbotRow) return
      const timestamp = new Date()
      let conversation = await db.query.channelConversation.findFirst({
        where: and(
          eq(channelConversation.tenantId, tenantId),
          eq(channelConversation.chatbotId, chatbotId),
          eq(channelConversation.channel, input.channel),
          eq(channelConversation.externalThreadId, input.externalUserId),
        ),
      })
      if (!conversation) {
        const [created] = await db
          .insert(channelConversation)
          .values({
            id: createUuidV7(),
            tenantId,
            projectId: chatbotRow.projectId,
            chatbotId,
            channel: input.channel,
            externalThreadId: input.externalUserId,
            status: "open",
            actionTrace: input.actionTrace ?? {},
            lastMessageAt: timestamp,
          })
          .returning()
        conversation = created
      }
      await db.insert(channelMessage).values([
        {
          id: createUuidV7(),
          tenantId,
          conversationId: conversation.id,
          direction: "inbound",
          messageType: "text",
          content: input.inboundText,
          sourceIds: [],
          actionTrace: {},
        },
        {
          id: createUuidV7(),
          tenantId,
          conversationId: conversation.id,
          direction: "outbound",
          messageType: "text",
          content: input.outboundText,
          sourceIds: [],
          actionTrace: input.actionTrace ?? {},
        },
      ])
      await db
        .update(channelConversation)
        .set({ actionTrace: input.actionTrace ?? {}, lastMessageAt: timestamp, updatedAt: timestamp })
        .where(and(eq(channelConversation.tenantId, tenantId), eq(channelConversation.id, conversation.id)))
    },
    async listConversations(chatbotId) {
      const tenantId = await ensureTenantId()
      const result = await pool.query<{
        id: string
        chatbot_id: string
        channel: ConnectorChannel
        external_thread_id: string | null
        status: string
        message_count: string
        last_user_message: string | null
        last_assistant_message: string | null
        last_message_at: string | null
        created_at: string
        updated_at: string
      }>(
        `select c.id,
                c.chatbot_id,
                c.channel,
                c.external_thread_id,
                c.status,
                count(m.id)::text as message_count,
                max(m.content) filter (where m.direction = 'inbound') as last_user_message,
                max(m.content) filter (where m.direction = 'outbound') as last_assistant_message,
                c.last_message_at,
                c.created_at,
                c.updated_at
           from channel_conversation c
           left join channel_message m on m.conversation_id = c.id
          where c.tenant_id = $1 and c.chatbot_id = $2
          group by c.id
          order by coalesce(c.last_message_at, c.updated_at) desc`,
        [tenantId, chatbotId],
      )
      return result.rows.map((row) => ({
        id: row.id,
        chatbotId: row.chatbot_id,
        channel: row.channel,
        externalThreadId: row.external_thread_id,
        status: row.status,
        messageCount: Number(row.message_count),
        lastUserMessage: row.last_user_message,
        lastAssistantMessage: row.last_assistant_message,
        lastMessageAt: row.last_message_at ? new Date(row.last_message_at).toISOString() : null,
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString(),
      }))
    },
    async recordAgentToolAction(input) {
      const tenantId = await ensureTenantId()
      const status = input.status ?? "recorded_for_follow_up"
      const metadata = { toolName: input.toolName, status, payload: input.payload }
      const [row] = await db
        .insert(auditLog)
        .values({
          id: createUuidV7(),
          tenantId,
          action: `agent_tool.${input.toolName}`,
          entityType: "agent_tool_action",
          metadata,
        })
        .returning()
      return mapAgentAction(row)
    },
    async listAgentActions() {
      const tenantId = await ensureTenantId()
      const rows = await db
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.tenantId, tenantId), like(auditLog.action, "agent_tool.%")))
        .orderBy(desc(auditLog.createdAt))
      return rows.map(mapAgentAction)
    },
  }
}

function mapProject(row: typeof project.$inferSelect, aiKeys: ProjectAiKeySummary = DEFAULT_PROJECT_AI_KEY_SUMMARY): ProjectDto {
  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    status: row.status as ProjectDto["status"],
    aiKeys,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function mapChatbot(row: typeof chatbot.$inferSelect): ChatbotDto {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    purpose: row.purpose,
    capabilities: normalizeCapabilities(row.capabilities),
    status: row.status as ChatbotDto["status"],
    agentKey: row.agentKey,
    knowledgeNamespace: row.knowledgeNamespace,
    runtimeStatus: normalizeRuntimeStatus(row.runtimeStatus),
    lastIndexedContentVersionId: row.lastIndexedContentVersionId,
    lastSyncError: row.lastSyncError,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function normalizeRuntimeStatus(value: string): ChatbotDto["runtimeStatus"] {
  if (value === "ready") return "live"
  if (["provisioning", "live", "syncing", "error", "paused"].includes(value)) {
    return value as ChatbotDto["runtimeStatus"]
  }
  return "provisioning"
}

function mapContent(row: typeof contentItem.$inferSelect, chatbotId: string): PlatformContentItemDto {
  const metadata = row.metadata as { projectId?: string; chatbotId?: string }
  return {
    id: row.id,
    projectId: metadata.projectId ?? "",
    chatbotId: metadata.chatbotId ?? chatbotId,
    contentType: row.contentType as PlatformContentType,
    title: row.title,
    slug: row.slug,
    body: row.body,
    status: row.status as PlatformContentStatus,
    publishedVersionId: row.publishedVersionId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function mapKnowledgeSource(
  row: typeof chatbotKnowledgeSource.$inferSelect,
  title: string,
  sourceType: string,
  chunkCount: number,
  indexedAt: Date,
): PlatformKnowledgeSourceDto {
  return {
    id: row.id,
    chatbotId: row.chatbotId ?? "",
    contentItemId: row.contentItemId,
    sourceVersionId: row.sourceVersionId,
    title,
    sourceType: sourceType as PlatformContentType,
    chunkCount,
    status: row.status as KnowledgeSyncStatus,
    indexedAt: indexedAt.toISOString(),
  }
}

function mapConnector(row: typeof channelConnector.$inferSelect): ChannelConnectorDto {
  return {
    id: row.id,
    chatbotId: row.chatbotId,
    channel: row.channel as ConnectorChannel,
    status: row.status as ConnectorStatus,
    displayName: row.displayName,
    config: row.config,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function mapDeployment(row: typeof chatbotDeployment.$inferSelect): ChatbotDeploymentDto {
  return {
    id: row.id,
    chatbotId: row.chatbotId,
    channel: "website",
    publicKey: row.publicKey,
    allowedDomains: row.allowedDomains,
    installStatus: row.installStatus as ChatbotDeploymentDto["installStatus"],
    installSnippet: `<script async src="/api/v1/widget/${row.publicKey}/widget.js"></script>`,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function mapAgentAction(row: typeof auditLog.$inferSelect): PlatformAgentActionDto {
  const metadata = row.metadata as Partial<{
    toolName: string
    status: string
    payload: Record<string, unknown>
  }>
  return {
    id: row.id,
    toolName: metadata.toolName ?? row.action.replace(/^agent_tool\./, ""),
    status: metadata.status ?? "recorded_for_follow_up",
    payload: metadata.payload ?? {},
    createdAt: row.createdAt.toISOString(),
  }
}

function normalizeCapabilities(input: Partial<ChatbotCapabilitiesDto> = {}): ChatbotCapabilitiesDto {
  return {
    faq: input.faq ?? true,
    leadCapture: input.leadCapture ?? true,
    appointmentBooking: input.appointmentBooking ?? false,
    propertyRecommendations: input.propertyRecommendations ?? false,
  }
}

function createDefaultConnectors(chatbotId: string, timestamp: string): ChannelConnectorDto[] {
  return [
    {
      id: createUuidV7(),
      chatbotId,
      channel: "website",
      status: "active",
      displayName: "Website widget",
      config: { installable: true },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: createUuidV7(),
      chatbotId,
      channel: "whatsapp",
      status: "needs_credentials",
      displayName: "WhatsApp Business",
      config: { requiresMetaCredentials: true },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: createUuidV7(),
      chatbotId,
      channel: "instagram_dm",
      status: "needs_credentials",
      displayName: "Instagram DM",
      config: { requiresMetaCredentials: true },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ]
}

function createWebsiteDeployment(chatbotId: string, domain: string | null | undefined, timestamp: string): ChatbotDeploymentDto {
  const publicKey = `pk_${chatbotId.replace(/-/g, "").slice(0, 24)}`
  return {
    id: createUuidV7(),
    chatbotId,
    channel: "website",
    publicKey,
    allowedDomains: domain ? [domain] : [],
    installStatus: "not_installed",
    installSnippet: `<script async src="/api/v1/widget/${publicKey}/widget.js"></script>`,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function chunkContent(title: string, body: string) {
  const words = body.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return [{ id: createUuidV7(), content: title.trim(), section: "body", metadata: { sourceTitle: title, chunkIndex: 0 } }]

  const targetTokens = 475
  const overlapTokens = 90
  const chunks: Array<{ id: string; content: string; section: string; metadata: Record<string, unknown> }> = []
  for (let start = 0, chunkIndex = 0; start < words.length; start += targetTokens - overlapTokens, chunkIndex += 1) {
    const end = Math.min(words.length, start + targetTokens)
    const content = `${title}\n\n${words.slice(start, end).join(" ")}`.trim()
    chunks.push({
      id: createUuidV7(),
      content,
      section: "body",
      metadata: {
        sourceTitle: title,
        chunkIndex,
        tokenStart: start,
        tokenEnd: end,
      },
    })
    if (end === words.length) break
  }
  return chunks
}

function embeddingColumnValues(embedding: number[], dimension: number) {
  const vector = serializePgVector(embedding)
  if (dimension === 384) return { embedding384: vector, embedding768: null, embedding: null }
  if (dimension === 768) return { embedding384: null, embedding768: vector, embedding: null }
  return { embedding384: null, embedding768: null, embedding: vector }
}

function vectorDistanceSql(dimension: number) {
  if (dimension === 384) return { column: "c.embedding_384", condition: "c.embedding_384 is not null" }
  if (dimension === 768) return { column: "c.embedding_768", condition: "c.embedding_768 is not null" }
  return { column: "c.embedding", condition: "c.embedding is not null" }
}

function searchChunksByEmbedding(sourceChunks: ChunkRecord[], queryEmbedding: number[], topK: number): PlatformSourceDto[] {
  if (sourceChunks.length === 0 || queryEmbedding.length === 0) return []

  return sourceChunks
    .map((chunk) => ({
      chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .filter(({ score }) => score >= MIN_VECTOR_RELEVANCE_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ chunk, score }) => ({
      chunkId: chunk.id,
      knowledgeSourceId: chunk.knowledgeSourceId,
      title: chunk.title,
      excerpt: excerpt(chunk.content),
      score: Number(score.toFixed(6)),
      sourceType: chunk.sourceType,
    }))
}

function searchChunksByKeywords(sourceChunks: ChunkRecord[], query: string, topK: number): PlatformSourceDto[] {
  const terms = [...new Set(query.toLowerCase().match(/[a-z0-9]+/g) ?? [])].filter((token) => token.length >= 3)
  if (terms.length === 0) return []

  return sourceChunks
    .map((chunk) => {
      const text = `${chunk.title} ${chunk.content}`.toLowerCase()
      const hits = terms.filter((term) => text.includes(term)).length
      return { chunk, hits }
    })
    .filter(({ hits }) => hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, topK)
    .map(({ chunk, hits }) => ({
      chunkId: chunk.id,
      knowledgeSourceId: chunk.knowledgeSourceId,
      title: chunk.title,
      excerpt: excerpt(chunk.content),
      score: Number((hits / terms.length).toFixed(6)),
      sourceType: chunk.sourceType,
    }))
}

function retrievePlatformSources(sourceChunks: ChunkRecord[], query: string, queryEmbedding: number[], topK: number): PlatformSourceDto[] {
  const vectorMatches = searchChunksByEmbedding(sourceChunks, queryEmbedding, topK)
  if (vectorMatches.length > 0) return vectorMatches
  return searchChunksByKeywords(sourceChunks, query, topK)
}

function cosineSimilarity(left: readonly number[], right: readonly number[]): number {
  const length = Math.min(left.length, right.length)
  let dot = 0
  for (let index = 0; index < length; index += 1) dot += left[index] * right[index]
  return dot
}

async function composePlatformAnswer(input: {
  message: string
  sources: PlatformSourceDto[]
  topK: number
  channel: ConnectorChannel
  chatbot: ChatbotDto
  chatbotId: string
  answerProvider?: PlatformAnswerProvider
  embeddingModel?: string
  llmConfig?: ProjectLlmRuntimeConfig
}): Promise<PlatformChatAnswerDto> {
  const safeSources = filterSupportedSources(
    input.message,
    isSensitiveQuery(input.message)
      ? input.sources.filter((source) => sourceSupportsSensitiveQuery(input.message, source))
      : input.sources,
  )
  const policy = buildAgentCapabilityPolicy({
    chatbotName: input.chatbot.name,
    purpose: input.chatbot.purpose,
    channel: input.channel,
    sourceIds: safeSources.map((source) => source.chunkId),
    capabilities: input.chatbot.capabilities,
    indexedSourceTypes: safeSources.map((source) => source.sourceType as AgentSourceType),
  })
  if (safeSources.length === 0) {
    return {
      answer: "I do not have an approved source for that yet. Add verified content, publish it to this chatbot, then test again.",
      fallback: true,
      sources: [],
      channel: input.channel,
      retrieval: { topK: input.topK, model: input.embeddingModel ?? "approved-source-search" },
      confidence: "none",
      actionTrace: {
        reason: "no_approved_source",
        channel: input.channel,
        policyVersion: policy.policyVersion,
        capabilityIds: policy.capabilityIds,
        toolsEnabled: policy.toolsEnabled,
        toolsDenied: policy.toolsDenied,
        sourceIds: [],
      },
    }
  }

  const providerResult = input.answerProvider
    ? await input.answerProvider({
        message: input.message,
        sources: safeSources,
        chatbot: input.chatbot,
        chatbotId: input.chatbotId,
        channel: input.channel,
        policy,
        llmConfig: input.llmConfig,
      })
    : null

  return {
    answer: providerResult?.answer ?? `Based on approved sources: ${safeSources.map((source) => source.excerpt).join("\n\n")}`,
    fallback: false,
    sources: safeSources,
    channel: input.channel,
    retrieval: { topK: input.topK, model: providerResult?.model ?? input.embeddingModel ?? "approved-source-search" },
    confidence: providerResult?.confidence ?? (safeSources[0]?.score >= 0.66 ? "high" : "medium"),
    actionTrace: {
      reason: "grounded_answer",
      channel: input.channel,
      sourceIds: safeSources.map((source) => source.chunkId),
      model: providerResult?.model ?? "approved-source-search",
      policyVersion: policy.policyVersion,
      capabilityIds: policy.capabilityIds,
      toolsEnabled: policy.toolsEnabled,
      toolsDenied: policy.toolsDenied,
      ...(providerResult?.actionTrace ?? {}),
    },
    agentTraceId: providerResult?.agentTraceId,
  }
}

function isSensitiveQuery(query: string) {
  return /\b(rera|legal|law|approval|approved|possession|handover|price|pricing|cost|discount|loan|mortgage|finance|registration|permit)\b/i.test(query)
}

function sourceSupportsSensitiveQuery(query: string, source: PlatformSourceDto) {
  const queryTerms = sensitiveTerms(query)
  const sourceText = `${source.title} ${source.excerpt}`.toLowerCase()
  return queryTerms.some((term) => sourceText.includes(term))
}

function filterSupportedSources(query: string, sources: PlatformSourceDto[]) {
  const terms = meaningfulQueryTerms(query)
  if (terms.length === 0) return []
  const requiredHits = Math.min(2, terms.length)

  return sources.filter((source) => {
    if (source.score >= STRONG_VECTOR_RELEVANCE_SCORE) return true
    const sourceText = `${source.title} ${source.excerpt}`.toLowerCase()
    const hits = terms.filter((term) => sourceContainsTerm(sourceText, term)).length
    return hits >= requiredHits
  })
}

function sourceContainsTerm(sourceText: string, term: string) {
  return termVariants(term).some((variant) => sourceText.includes(variant))
}

function termVariants(term: string) {
  const variants = new Set([term, `${term}s`, `${term}ing`, `${term}ings`])
  if (term.endsWith("e") && term.length > 3) {
    const stem = term.slice(0, -1)
    variants.add(`${stem}ing`)
    variants.add(`${stem}ings`)
  }
  if (term.endsWith("y") && term.length > 3) variants.add(`${term.slice(0, -1)}ies`)
  if (term.endsWith("s") && term.length > 3) variants.add(term.slice(0, -1))
  return [...variants]
}

function meaningfulQueryTerms(query: string) {
  const stopwords = new Set([
    "about",
    "after",
    "again",
    "also",
    "and",
    "any",
    "are",
    "can",
    "could",
    "current",
    "does",
    "estate",
    "for",
    "from",
    "have",
    "how",
    "into",
    "now",
    "our",
    "project",
    "properties",
    "property",
    "realty",
    "right",
    "should",
    "that",
    "the",
    "this",
    "what",
    "when",
    "where",
    "which",
    "who",
    "why",
    "with",
    "would",
    "you",
  ])

  return [...new Set(query.toLowerCase().match(/[a-z0-9]+/g) ?? [])]
    .filter((token) => token.length >= 3 && !stopwords.has(token))
}

function sensitiveTerms(query: string) {
  const normalized = query.toLowerCase()
  const groups = [
    ["rera", "registration", "permit"],
    ["legal", "law", "approval", "approved"],
    ["possession", "handover"],
    ["price", "pricing", "cost", "discount"],
    ["loan", "mortgage", "finance"],
  ]
  return groups.flatMap((group) => (group.some((term) => normalized.includes(term)) ? group : []))
}

function excerpt(value: string) {
  return value.length > 320 ? `${value.slice(0, 317)}...` : value
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "content"
  )
}

function createAgentKey(chatbotId: string) {
  return `chatbot_${chatbotId.replace(/-/g, "")}`
}

function createKnowledgeNamespace(chatbotId: string) {
  return `knowledge_${chatbotId.replace(/-/g, "")}`
}
