import { createUuidV7 } from "@workspace/core"
import { and, desc, eq, like, sql } from "drizzle-orm"
import type { Pool } from "pg"

import type { AppDb } from "./index.js"
import { STUB_EMBEDDING_DIMENSION, embedTextStubHashV1, DEFAULT_TENANT_DOMAIN } from "./phase1a.js"
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
  ragDocument,
  tenant,
} from "./schema.js"

export type ChatbotCapability = "faq" | "lead_capture" | "appointment_booking"
export type ConnectorChannel = "website" | "whatsapp" | "instagram_dm"
export type ConnectorStatus = "active" | "not_configured" | "needs_credentials" | "error" | "paused"
export type KnowledgeSyncStatus = "pending" | "syncing" | "indexed" | "failed"
export type PlatformContentStatus = "draft" | "published"
export type PlatformContentType = "project" | "property" | "faq" | "area" | "policy" | "general"

export interface ProjectDto {
  id: string
  name: string
  domain: string | null
  status: "active" | "archived"
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
  runtimeStatus: "ready" | "syncing" | "error" | "paused"
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
}

export interface PlatformAnswerProviderResult {
  answer: string
  model: string
  confidence?: PlatformChatAnswerDto["confidence"]
  actionTrace?: Record<string, unknown>
  agentTraceId?: string
}

export type PlatformAnswerProvider = (input: PlatformAnswerProviderInput) => Promise<PlatformAnswerProviderResult>

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
  publishContent(chatbotId: string, contentId: string): Promise<{ item: PlatformContentItemDto; source: PlatformKnowledgeSourceDto; chunkCount: number } | null>
  deleteContent(chatbotId: string, contentId: string): Promise<PlatformContentItemDto | null>
  listKnowledge(chatbotId: string): Promise<PlatformKnowledgeSourceDto[]>
  testMessage(chatbotId: string, input: { message: string; topK?: number; channel?: ConnectorChannel }): Promise<PlatformChatAnswerDto | null>
  listConnectors(chatbotId: string): Promise<{ connectors: ChannelConnectorDto[]; deployment: ChatbotDeploymentDto } | null>
  updateConnectorStatus(chatbotId: string, channel: ConnectorChannel, status: ConnectorStatus): Promise<ChannelConnectorDto | null>
  updateWebsiteAllowedDomains(chatbotId: string, allowedDomains: string[]): Promise<ChatbotDeploymentDto | null>
  updateWebsiteInstallStatus(chatbotId: string, status: ChatbotDeploymentDto["installStatus"]): Promise<ChatbotDeploymentDto | null>
  getDeploymentByPublicKey(publicKey: string): Promise<ChatbotDeploymentDto | null>
  sendWidgetMessage(publicKey: string, input: { message: string; anonymousSessionId?: string }): Promise<PlatformChatAnswerDto | null>
  listConversations(chatbotId: string): Promise<PlatformConversationSummaryDto[]>
  recordAgentToolAction(input: { toolName: string; payload: Record<string, unknown>; status?: string }): Promise<PlatformAgentActionDto>
  listAgentActions(): Promise<PlatformAgentActionDto[]>
  close?(): Promise<void>
}

interface ChunkRecord {
  id: string
  knowledgeSourceId: string
  chatbotId: string
  content: string
  title: string
  sourceVersionId: string
}

export function createInMemoryProductionChatbotStore(options: { answerProvider?: PlatformAnswerProvider } = {}): ProductionChatbotStore {
  const projects = new Map<string, ProjectDto>()
  const chatbots = new Map<string, ChatbotDto>()
  const contentItems = new Map<string, PlatformContentItemDto>()
  const knowledgeSources = new Map<string, PlatformKnowledgeSourceDto>()
  const chunks = new Map<string, ChunkRecord>()
  const connectors = new Map<string, ChannelConnectorDto[]>()
  const deployments = new Map<string, ChatbotDeploymentDto>()
  const conversations = new Map<string, PlatformConversationSummaryDto>()
  const agentActions = new Map<string, PlatformAgentActionDto>()

  const now = () => new Date().toISOString()

  return {
    async listProjects() {
      return [...projects.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
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
      return existing
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
        runtimeStatus: "ready",
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
      const next: ChatbotDto = { ...existing, status: "active", runtimeStatus: "ready", updatedAt: now() }
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
      const item: PlatformContentItemDto = {
        ...existing,
        status: "published",
        publishedVersionId: versionId,
        updatedAt: timestamp,
      }
      contentItems.set(item.id, item)

      for (const [chunkId, chunk] of chunks) {
        if (chunk.sourceVersionId === versionId || chunk.knowledgeSourceId === contentId) chunks.delete(chunkId)
      }
      const sourceChunks = chunkContent(item.title, item.body)
      const source: PlatformKnowledgeSourceDto = {
        id: createUuidV7(),
        chatbotId,
        contentItemId: item.id,
        sourceVersionId: versionId,
        title: item.title,
        sourceType: item.contentType,
        chunkCount: sourceChunks.length,
        status: "indexed",
        indexedAt: timestamp,
      }
      knowledgeSources.set(source.id, source)
      for (const chunk of sourceChunks) {
        chunks.set(chunk.id, {
          id: chunk.id,
          knowledgeSourceId: source.id,
          chatbotId,
          content: chunk.content,
          title: item.title,
          sourceVersionId: versionId,
        })
      }
      const existingChatbot = chatbots.get(chatbotId)
      if (existingChatbot) {
        chatbots.set(chatbotId, {
          ...existingChatbot,
          runtimeStatus: "ready",
          lastIndexedContentVersionId: versionId,
          lastSyncError: null,
          updatedAt: timestamp,
        })
      }
      return { item, source, chunkCount: sourceChunks.length }
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
      const sources = searchChunks([...chunks.values()].filter((chunk) => chunk.chatbotId === chatbotId), input.message, topK)
      return composePlatformAnswer({
        message: input.message,
        sources,
        topK,
        channel: input.channel ?? "website",
        chatbot,
        chatbotId,
        answerProvider: options.answerProvider,
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

export function createDrizzleProductionChatbotStore(db: AppDb, pool: Pool, options: { answerProvider?: PlatformAnswerProvider } = {}): ProductionChatbotStore {
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

  return {
    async listProjects() {
      const tenantId = await ensureTenantId()
      const rows = await db.query.project.findMany({ where: eq(project.tenantId, tenantId), orderBy: [desc(project.updatedAt)] })
      return rows.map(mapProject)
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
      await db
        .delete(project)
        .where(and(eq(project.tenantId, tenantId), eq(project.id, id)))
      return mapped
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
          runtimeStatus: "ready",
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
        .set({ status: "active", runtimeStatus: "ready", updatedAt: new Date() })
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
      const sourceChunks = chunkContent(published.title, published.body)
      await db.insert(ragDocument).values({
        id: documentId,
        tenantId,
        sourceType: published.contentType,
        sourceId: published.id,
        sourceVersionId: versionId,
        title: published.title,
        status: "indexed",
        chunkCount: sourceChunks.length,
        publishedAt,
        indexedAt: publishedAt,
      })
      for (const [index, chunk] of sourceChunks.entries()) {
        await db.insert(ragChunk).values({
          id: chunk.id,
          tenantId,
          documentId,
          sourceVersionId: versionId,
          chunkIndex: index,
          section: "body",
          content: chunk.content,
          metadata: {},
          embedding: serializePgVector(embedTextStubHashV1(chunk.content)),
          embeddingModel: "stub/hash-v1",
          embeddingDimension: STUB_EMBEDDING_DIMENSION,
        })
      }
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
          status: "indexed",
        })
        .returning()
      await db
        .update(chatbot)
        .set({
          runtimeStatus: "ready",
          lastIndexedContentVersionId: versionId,
          lastSyncError: null,
          updatedAt: publishedAt,
        })
        .where(and(eq(chatbot.tenantId, tenantId), eq(chatbot.id, chatbotId)))
      return { item: mapContent(published, chatbotId), source: mapKnowledgeSource(sourceRow, published.title, published.contentType, sourceChunks.length, publishedAt), chunkCount: sourceChunks.length }
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
        indexed_at: string
      }>(
        `select ks.id,
                ks.content_item_id,
                ks.source_version_id,
                d.title,
                d.source_type,
                d.chunk_count,
                coalesce(d.indexed_at, ks.updated_at) as indexed_at
           from chatbot_knowledge_source ks
           join rag_document d on d.source_version_id = ks.source_version_id
          where ks.tenant_id = $1 and ks.chatbot_id = $2 and ks.status = 'indexed'
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
        status: "indexed",
        indexedAt: new Date(row.indexed_at).toISOString(),
      }))
    },
    async testMessage(chatbotId, input) {
      const tenantId = await ensureTenantId()
      const chatbotRow = await db.query.chatbot.findFirst({ where: and(eq(chatbot.tenantId, tenantId), eq(chatbot.id, chatbotId)) })
      if (!chatbotRow) return null
      const result = await pool.query<{
        chunk_id: string
        knowledge_source_id: string
        title: string
        content: string
        source_version_id: string
      }>(
        `select c.id as chunk_id,
                ks.id as knowledge_source_id,
                d.title,
                c.content,
                c.source_version_id
           from chatbot_knowledge_source ks
           join rag_document d on d.source_version_id = ks.source_version_id
           join rag_chunk c on c.source_version_id = ks.source_version_id
          where ks.tenant_id = $1 and ks.chatbot_id = $2 and ks.status = 'indexed'`,
        [tenantId, chatbotId],
      )
      const sourceChunks = result.rows.map((row) => ({
        id: row.chunk_id,
        knowledgeSourceId: row.knowledge_source_id,
        chatbotId,
        content: row.content,
        title: row.title,
        sourceVersionId: row.source_version_id,
      }))
      const topK = input.topK ?? 5
      const chatbotDto = mapChatbot(chatbotRow)
      return composePlatformAnswer({
        message: input.message,
        sources: searchChunks(sourceChunks, input.message, topK),
        topK,
        channel: input.channel ?? "website",
        chatbot: chatbotDto,
        chatbotId,
        answerProvider: options.answerProvider,
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

function mapProject(row: typeof project.$inferSelect): ProjectDto {
  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    status: row.status as ProjectDto["status"],
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
    runtimeStatus: row.runtimeStatus as ChatbotDto["runtimeStatus"],
    lastIndexedContentVersionId: row.lastIndexedContentVersionId,
    lastSyncError: row.lastSyncError,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
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
  const text = `${title}\n\n${body}`.trim()
  return [{ id: createUuidV7(), content: text }]
}

function searchChunks(sourceChunks: ChunkRecord[], query: string, topK: number): PlatformSourceDto[] {
  const terms = queryTokens(query)
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
    }))
}

async function composePlatformAnswer(input: {
  message: string
  sources: PlatformSourceDto[]
  topK: number
  channel: ConnectorChannel
  chatbot: ChatbotDto
  chatbotId: string
  answerProvider?: PlatformAnswerProvider
}): Promise<PlatformChatAnswerDto> {
  const safeSources = isSensitiveQuery(input.message) ? input.sources.filter((source) => sourceSupportsSensitiveQuery(input.message, source)) : input.sources
  if (safeSources.length === 0) {
    return {
      answer: "I do not have an approved source for that yet. Add verified content, publish it to this chatbot, then test again.",
      fallback: true,
      sources: [],
      channel: input.channel,
      retrieval: { topK: input.topK, model: "approved-source-search" },
      confidence: "none",
      actionTrace: { reason: "no_approved_source", channel: input.channel },
    }
  }

  const providerResult = input.answerProvider
    ? await input.answerProvider({ message: input.message, sources: safeSources, chatbot: input.chatbot, chatbotId: input.chatbotId, channel: input.channel })
    : null

  return {
    answer: providerResult?.answer ?? `Based on approved sources: ${safeSources.map((source) => source.excerpt).join("\n\n")}`,
    fallback: false,
    sources: safeSources,
    channel: input.channel,
    retrieval: { topK: input.topK, model: providerResult?.model ?? "approved-source-search" },
    confidence: providerResult?.confidence ?? (safeSources[0]?.score >= 0.66 ? "high" : "medium"),
    actionTrace: {
      reason: "grounded_answer",
      channel: input.channel,
      sourceIds: safeSources.map((source) => source.chunkId),
      model: providerResult?.model ?? "approved-source-search",
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

function queryTokens(query: string) {
  return [...new Set(query.toLowerCase().match(/[a-z0-9]+/g) ?? [])].filter((token) => token.length >= 3)
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

function serializePgVector(vector: readonly number[]) {
  return `[${vector.join(",")}]`
}
