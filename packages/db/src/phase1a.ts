import { createUuidV7 } from "@workspace/core"
import { and, desc, eq, sql } from "drizzle-orm"
import type { Pool } from "pg"

import type { AppDb } from "./index.js"
import {
  adminUserStub,
  auditLog,
  channelConversation,
  channelMessage,
  contentItem,
  contentVersion,
  ragChunk,
  ragDocument,
  tenant,
} from "./schema.js"

export const STUB_EMBEDDING_MODEL = "stub/hash-v1"
export const STUB_EMBEDDING_DIMENSION = 1024
export const STUB_MIN_RELEVANCE_SCORE = 0.05
export const DEFAULT_TENANT_DOMAIN = "dev.khanect.local"
export const DEFAULT_ADMIN_EMAIL = "admin.stub@khanect.local"

export type ContentStatus = "draft" | "published"
export type ContentType = "project" | "property" | "faq" | "area" | "policy" | "general"

export interface AdminContext {
  tenantId: string
  userId: string
  email: string
  roles: string[]
  authMode: "dev-stub"
  productionAuth: false
}

export interface ContentItemDto {
  id: string
  tenantId: string
  contentType: ContentType
  title: string
  slug: string
  body: string
  status: ContentStatus
  metadata: Record<string, unknown>
  publishedVersionId: string | null
  createdAt: string
  updatedAt: string
}

export interface ContentInput {
  contentType?: ContentType
  title: string
  slug?: string
  body: string
  metadata?: Record<string, unknown>
}

export interface PublishResult {
  item: ContentItemDto
  versionId: string
  documentId: string
  chunkCount: number
}

export interface RagDocumentDto {
  id: string
  tenantId: string
  sourceType: string
  sourceId: string
  sourceVersionId: string
  title: string
  language: string
  status: string
  chunkCount: number
  indexedAt: string | null
}

export interface RagChunkDto {
  id: string
  documentId: string
  sourceVersionId: string
  chunkIndex: number
  section: string
  content: string
  metadata: Record<string, unknown>
  embeddingModel: string
  embeddingDimension: number
}

export interface SearchResult {
  chunkId: string
  documentId: string
  sourceVersionId: string
  title: string
  excerpt: string
  score: number
}

export interface ChatAnswer {
  answer: string
  fallback: boolean
  sources: SearchResult[]
  retrieval: {
    topK: number
    embeddingModel: typeof STUB_EMBEDDING_MODEL
  }
  leadScore: {
    score: 0
    band: "cold"
    reasonCodes: string[]
  }
  handoff: null
}

export interface ChatSessionDto {
  id: string
  tenantId: string
  channel: "website"
  status: string
  actionTrace: Record<string, unknown>
  lastMessageAt: string | null
  createdAt: string
}

export interface ChatMessageDto {
  id: string
  conversationId: string
  direction: string
  messageType: string
  content: string
  sourceIds: string[]
  actionTrace: Record<string, unknown>
  createdAt: string
}

export interface Phase1aStore {
  getAdminContext(): Promise<AdminContext>
  listContent(): Promise<ContentItemDto[]>
  createContent(input: ContentInput): Promise<ContentItemDto>
  getContent(id: string): Promise<ContentItemDto | null>
  patchContent(id: string, input: Partial<ContentInput>): Promise<ContentItemDto | null>
  publishContent(id: string): Promise<PublishResult | null>
  listDocuments(): Promise<RagDocumentDto[]>
  listChunks(documentId: string): Promise<RagChunkDto[]>
  reindexContent(contentItemId?: string): Promise<{ indexed: number; chunks: number }>
  search(query: string, topK?: number): Promise<SearchResult[]>
  createChatSession(): Promise<ChatSessionDto>
  listChatSessions(): Promise<ChatSessionDto[]>
  listChatMessages(sessionId: string): Promise<ChatMessageDto[]>
  sendChatMessage(input: { sessionId?: string; message: string; topK?: number }): Promise<ChatAnswer & { sessionId: string }>
  close?(): Promise<void>
}

export function embedTextStubHashV1(input: string): number[] {
  const buckets = new Float64Array(STUB_EMBEDDING_DIMENSION)
  const normalized = input.normalize("NFKC").toLowerCase().trim()
  const tokens = normalized.match(/[\p{L}\p{N}]+/gu) ?? [normalized]

  for (const token of tokens) {
    let hash = 2166136261
    for (let index = 0; index < token.length; index += 1) {
      hash ^= token.charCodeAt(index)
      hash = Math.imul(hash, 16777619) >>> 0
    }

    const bucket = hash % STUB_EMBEDDING_DIMENSION
    const sign = (hash & 1) === 0 ? 1 : -1
    buckets[bucket] += sign * Math.max(1, token.length / 8)
  }

  let magnitude = 0
  for (const value of buckets) magnitude += value * value
  magnitude = Math.sqrt(magnitude) || 1

  return Array.from(buckets, (value) => Number((value / magnitude).toFixed(8)))
}

export function serializePgVector(vector: readonly number[]): string {
  if (vector.length !== STUB_EMBEDDING_DIMENSION) {
    throw new Error(`stub/hash-v1 embedding must have ${STUB_EMBEDDING_DIMENSION} dimensions`)
  }
  return `[${vector.join(",")}]`
}

export function chunkContent(input: { title: string; body: string; sourceVersionId: string }): RagChunkDto[] {
  const text = `${input.title}\n\n${input.body}`.replace(/\s+/g, " ").trim()
  if (!text) return []

  const maxLength = 700
  const overlap = 100
  const chunks: RagChunkDto[] = []
  let start = 0

  while (start < text.length) {
    let end = Math.min(text.length, start + maxLength)
    if (end < text.length) {
      const lastSentence = text.lastIndexOf(".", end)
      if (lastSentence > start + 200) end = lastSentence + 1
    }

    const content = text.slice(start, end).trim()
    chunks.push({
      id: createUuidV7(),
      documentId: "",
      sourceVersionId: input.sourceVersionId,
      chunkIndex: chunks.length,
      section: "body",
      content,
      metadata: {
        sourceVersionId: input.sourceVersionId,
        chunkVersion: "phase1a-v1",
        embeddingModel: STUB_EMBEDDING_MODEL,
        embeddingDimension: STUB_EMBEDDING_DIMENSION,
      },
      embeddingModel: STUB_EMBEDDING_MODEL,
      embeddingDimension: STUB_EMBEDDING_DIMENSION,
    })

    if (end >= text.length) break
    start = Math.max(0, end - overlap)
  }

  return chunks
}

export function composeGroundedAnswer(query: string, sources: SearchResult[], topK = 5): ChatAnswer {
  if (sources.length === 0) return fallbackAnswer(topK)

  if (isSensitiveQuery(query) && !sources.some((source) => sourceSupportsSensitiveQuery(query, source))) {
    return fallbackAnswer(topK)
  }

  const snippets = sources
    .slice(0, topK)
    .map((source, index) => `${index + 1}. ${source.excerpt}`)
    .join("\n")

  return {
    answer: `Based on approved admin content for "${query}":\n${snippets}`,
    fallback: false,
    sources,
    retrieval: { topK, embeddingModel: STUB_EMBEDDING_MODEL },
    leadScore: { score: 0, band: "cold", reasonCodes: [] },
    handoff: null,
  }
}

export function createInMemoryPhase1aStore(): Phase1aStore {
  const tenantId = createUuidV7()
  const userId = createUuidV7()
  const items = new Map<string, ContentItemDto>()
  const versions = new Map<string, { itemId: string; versionNumber: number; snapshot: ContentItemDto }>()
  const documents = new Map<string, RagDocumentDto>()
  const chunks = new Map<string, RagChunkDto & { vector: number[]; title: string }>()
  const sessions = new Map<string, ChatSessionDto>()
  const messages = new Map<string, ChatMessageDto[]>()

  const now = () => new Date().toISOString()
  const admin = async (): Promise<AdminContext> => ({
    tenantId,
    userId,
    email: DEFAULT_ADMIN_EMAIL,
    roles: ["admin", "rag_lab"],
    authMode: "dev-stub",
    productionAuth: false,
  })

  async function indexItem(item: ContentItemDto) {
    if (item.status !== "published" || !item.publishedVersionId) return { documentId: "", chunkCount: 0 }
    const version = versions.get(item.publishedVersionId)
    if (!version) return { documentId: "", chunkCount: 0 }
    const snapshot = version.snapshot
    const documentId = createUuidV7()
    const sourceChunks = chunkContent({ title: snapshot.title, body: snapshot.body, sourceVersionId: item.publishedVersionId })

    for (const [chunkId, chunk] of chunks) {
      if (chunk.sourceVersionId === item.publishedVersionId) chunks.delete(chunkId)
    }
    for (const [existingId, doc] of documents) {
      if (doc.sourceVersionId === item.publishedVersionId) documents.delete(existingId)
    }

    documents.set(documentId, {
      id: documentId,
      tenantId,
      sourceType: snapshot.contentType,
      sourceId: item.id,
      sourceVersionId: item.publishedVersionId,
      title: snapshot.title,
      language: "en",
      status: "indexed",
      chunkCount: sourceChunks.length,
      indexedAt: now(),
    })

    for (const chunk of sourceChunks) {
      chunks.set(chunk.id, {
        ...chunk,
        documentId,
        vector: embedTextStubHashV1(chunk.content),
        title: snapshot.title,
      })
    }

    return { documentId, chunkCount: sourceChunks.length }
  }

  return {
    getAdminContext: admin,
    async listContent() {
      return [...items.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },
    async createContent(input) {
      const timestamp = now()
      const item: ContentItemDto = {
        id: createUuidV7(),
        tenantId,
        contentType: input.contentType ?? "general",
        title: input.title,
        slug: input.slug ?? slugify(input.title),
        body: input.body,
        status: "draft",
        metadata: input.metadata ?? {},
        publishedVersionId: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      items.set(item.id, item)
      return item
    },
    async getContent(id) {
      return items.get(id) ?? null
    },
    async patchContent(id, input) {
      const existing = items.get(id)
      if (!existing) return null
      const contentChanged = input.title !== undefined || input.body !== undefined || input.contentType !== undefined || input.metadata !== undefined
      const next: ContentItemDto = {
        ...existing,
        contentType: input.contentType ?? existing.contentType,
        title: input.title ?? existing.title,
        slug: input.slug ?? existing.slug,
        body: input.body ?? existing.body,
        status: existing.status === "published" && contentChanged ? "draft" : existing.status,
        metadata: input.metadata ?? existing.metadata,
        updatedAt: now(),
      }
      items.set(id, next)
      return next
    },
    async publishContent(id) {
      const existing = items.get(id)
      if (!existing) return null
      const versionId = createUuidV7()
      const versionNumber = [...versions.values()].filter((version) => version.itemId === id).length + 1
      const item = { ...existing, status: "published" as const, publishedVersionId: versionId, updatedAt: now() }
      items.set(id, item)
      versions.set(versionId, { itemId: id, versionNumber, snapshot: item })
      const indexed = await indexItem(item)
      return { item, versionId, documentId: indexed.documentId, chunkCount: indexed.chunkCount }
    },
    async listDocuments() {
      return [...documents.values()].sort((a, b) => (b.indexedAt ?? "").localeCompare(a.indexedAt ?? ""))
    },
    async listChunks(documentId) {
      return [...chunks.values()]
        .filter((chunk) => chunk.documentId === documentId)
        .sort((a, b) => a.chunkIndex - b.chunkIndex)
        .map(({ vector: _vector, title: _title, ...chunk }) => chunk)
    },
    async reindexContent(contentItemId) {
      const candidates = [...items.values()].filter(
        (item) => item.status === "published" && (!contentItemId || item.id === contentItemId),
      )
      let chunkCount = 0
      for (const item of candidates) {
        const indexed = await indexItem(item)
        chunkCount += indexed.chunkCount
      }
      return { indexed: candidates.length, chunks: chunkCount }
    },
    async search(query, topK = 5) {
      const queryVector = embedTextStubHashV1(query)
      return [...chunks.values()]
        .filter((chunk) => hasLexicalOverlap(query, `${chunk.title} ${chunk.content}`))
        .map((chunk) => ({ chunk, score: cosineSimilarity(queryVector, chunk.vector) }))
        .filter((result) => result.score >= STUB_MIN_RELEVANCE_SCORE)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .map(({ chunk, score }) => ({
          chunkId: chunk.id,
          documentId: chunk.documentId,
          sourceVersionId: chunk.sourceVersionId,
          title: chunk.title,
          excerpt: excerpt(chunk.content),
          score: Number(score.toFixed(6)),
        }))
    },
    async createChatSession() {
      const session: ChatSessionDto = {
        id: createUuidV7(),
        tenantId,
        channel: "website",
        status: "open",
        actionTrace: { lab: true, authMode: "dev-stub" },
        lastMessageAt: null,
        createdAt: now(),
      }
      sessions.set(session.id, session)
      messages.set(session.id, [])
      return session
    },
    async listChatSessions() {
      return [...sessions.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },
    async listChatMessages(sessionId) {
      return messages.get(sessionId) ?? []
    },
    async sendChatMessage(input) {
      const session = input.sessionId ? sessions.get(input.sessionId) : await this.createChatSession()
      if (!session) throw new Error("Chat session not found")
      const topK = input.topK ?? 5
      const sources = await this.search(input.message, topK)
      const answer = composeGroundedAnswer(input.message, sources, topK)
      const timestamp = now()
      const transcript = messages.get(session.id) ?? []
      transcript.push({
        id: createUuidV7(),
        conversationId: session.id,
        direction: "inbound",
        messageType: "text",
        content: input.message,
        sourceIds: [],
        actionTrace: { lab: true },
        createdAt: timestamp,
      })
      transcript.push({
        id: createUuidV7(),
        conversationId: session.id,
        direction: "outbound",
        messageType: "text",
        content: answer.answer,
        sourceIds: answer.sources.map((source) => source.chunkId),
        actionTrace: { lab: true, fallback: answer.fallback, retrieval: answer.retrieval },
        createdAt: timestamp,
      })
      messages.set(session.id, transcript)
      sessions.set(session.id, { ...session, lastMessageAt: timestamp })
      return { sessionId: session.id, ...answer }
    },
  }
}

export function createDrizzlePhase1aStore(db: AppDb, pool: Pool): Phase1aStore {
  let adminCache: AdminContext | null = null

  async function ensureAdmin(): Promise<AdminContext> {
    if (adminCache) return adminCache

    let tenantRow = await db.query.tenant.findFirst({ where: eq(tenant.domain, DEFAULT_TENANT_DOMAIN) })
    if (!tenantRow) {
      const [created] = await db
        .insert(tenant)
        .values({ id: createUuidV7(), name: "Khanect Omni Realty Dev", domain: DEFAULT_TENANT_DOMAIN })
        .returning()
      tenantRow = created
    }

    let userRow = await db.query.adminUserStub.findFirst({ where: eq(adminUserStub.email, DEFAULT_ADMIN_EMAIL) })
    if (!userRow) {
      const [created] = await db
        .insert(adminUserStub)
        .values({ id: createUuidV7(), tenantId: tenantRow.id, email: DEFAULT_ADMIN_EMAIL, roles: ["admin", "rag_lab"] })
        .returning()
      userRow = created
    }

    adminCache = {
      tenantId: tenantRow.id,
      userId: userRow.id,
      email: userRow.email,
      roles: userRow.roles,
      authMode: "dev-stub",
      productionAuth: false,
    }
    return adminCache
  }

  async function writeAudit(action: string, entityType?: string, entityId?: string, metadata: Record<string, unknown> = {}) {
    const admin = await ensureAdmin()
    await db.insert(auditLog).values({
      id: createUuidV7(),
      tenantId: admin.tenantId,
      actorId: admin.userId,
      action,
      entityType,
      entityId,
      metadata,
    })
  }

  async function indexPublishedContent(itemId: string) {
    const admin = await ensureAdmin()
    const item = await db.query.contentItem.findFirst({
      where: and(eq(contentItem.tenantId, admin.tenantId), eq(contentItem.id, itemId)),
    })
    if (!item || item.status !== "published" || !item.publishedVersionId) return { documentId: "", chunkCount: 0 }

    const version = await db.query.contentVersion.findFirst({ where: eq(contentVersion.id, item.publishedVersionId) })
    if (!version || version.state !== "published") return { documentId: "", chunkCount: 0 }
    const snapshot = parseContentSnapshot(version.snapshotJson)

    const existing = await db.query.ragDocument.findFirst({
      where: and(eq(ragDocument.tenantId, admin.tenantId), eq(ragDocument.sourceVersionId, version.id)),
    })
    const documentId = existing?.id ?? createUuidV7()
    await db.delete(ragChunk).where(eq(ragChunk.documentId, documentId))

    if (existing) {
      await db
        .update(ragDocument)
        .set({ title: snapshot.title, status: "indexing", chunkCount: 0, updatedAt: new Date() })
        .where(eq(ragDocument.id, documentId))
    } else {
      await db.insert(ragDocument).values({
        id: documentId,
        tenantId: admin.tenantId,
        sourceType: snapshot.contentType,
        sourceId: item.id,
        sourceVersionId: version.id,
        title: snapshot.title,
        status: "indexing",
        publishedAt: version.publishedAt,
      })
    }

    const sourceChunks = chunkContent({ title: snapshot.title, body: snapshot.body, sourceVersionId: version.id })
    for (const chunk of sourceChunks) {
      await db.insert(ragChunk).values({
        id: chunk.id,
        tenantId: admin.tenantId,
        documentId,
        sourceVersionId: version.id,
        chunkIndex: chunk.chunkIndex,
        section: chunk.section,
        content: chunk.content,
        metadata: chunk.metadata,
        embedding: serializePgVector(embedTextStubHashV1(chunk.content)),
        embeddingModel: STUB_EMBEDDING_MODEL,
        embeddingDimension: STUB_EMBEDDING_DIMENSION,
      })
    }

    await db
      .update(ragDocument)
      .set({ status: "indexed", chunkCount: sourceChunks.length, indexedAt: new Date(), updatedAt: new Date() })
      .where(eq(ragDocument.id, documentId))

    await writeAudit("rag.index", "content_item", item.id, { sourceVersionId: version.id, chunkCount: sourceChunks.length })
    return { documentId, chunkCount: sourceChunks.length }
  }

  return {
    getAdminContext: ensureAdmin,
    async listContent() {
      const admin = await ensureAdmin()
      const rows = await db.query.contentItem.findMany({
        where: eq(contentItem.tenantId, admin.tenantId),
        orderBy: [desc(contentItem.updatedAt)],
      })
      return rows.map(mapContentItem)
    },
    async createContent(input) {
      const admin = await ensureAdmin()
      const [row] = await db
        .insert(contentItem)
        .values({
          id: createUuidV7(),
          tenantId: admin.tenantId,
          contentType: input.contentType ?? "general",
          title: input.title,
          slug: input.slug ?? slugify(input.title),
          body: input.body,
          metadata: input.metadata ?? {},
          status: "draft",
        })
        .returning()
      await writeAudit("content.create", "content_item", row.id, { contentType: row.contentType })
      return mapContentItem(row)
    },
    async getContent(id) {
      const admin = await ensureAdmin()
      const row = await db.query.contentItem.findFirst({
        where: and(eq(contentItem.tenantId, admin.tenantId), eq(contentItem.id, id)),
      })
      return row ? mapContentItem(row) : null
    },
    async patchContent(id, input) {
      const admin = await ensureAdmin()
      const existing = await db.query.contentItem.findFirst({
        where: and(eq(contentItem.tenantId, admin.tenantId), eq(contentItem.id, id)),
      })
      if (!existing) return null
      const contentChanged = input.title !== undefined || input.body !== undefined || input.contentType !== undefined || input.metadata !== undefined
      const nextStatus = existing.status === "published" && contentChanged ? "draft" : existing.status
      const [row] = await db
        .update(contentItem)
        .set({
          contentType: input.contentType,
          title: input.title,
          slug: input.slug,
          body: input.body,
          status: nextStatus,
          metadata: input.metadata,
          updatedAt: new Date(),
        })
        .where(and(eq(contentItem.tenantId, admin.tenantId), eq(contentItem.id, id)))
        .returning()
      if (!row) return null
      await writeAudit("content.patch", "content_item", row.id)
      return mapContentItem(row)
    },
    async publishContent(id) {
      const admin = await ensureAdmin()
      const item = await db.query.contentItem.findFirst({
        where: and(eq(contentItem.tenantId, admin.tenantId), eq(contentItem.id, id)),
      })
      if (!item) return null

      const [{ maxVersion }] = await db
        .select({ maxVersion: sql<number>`coalesce(max(${contentVersion.versionNumber}), 0)` })
        .from(contentVersion)
        .where(and(eq(contentVersion.tenantId, admin.tenantId), eq(contentVersion.entityId, id)))
      const versionId = createUuidV7()
      const publishedAt = new Date()
      const publishedSnapshot: ContentItemDto = {
        ...mapContentItem(item),
        status: "published",
        publishedVersionId: versionId,
        updatedAt: publishedAt.toISOString(),
      }
      await db.insert(contentVersion).values({
        id: versionId,
        tenantId: admin.tenantId,
        entityType: "content_item",
        entityId: item.id,
        versionNumber: Number(maxVersion) + 1,
        state: "published",
        snapshotJson: { ...publishedSnapshot },
        publishedAt,
      })
      const [published] = await db
        .update(contentItem)
        .set({ status: "published", publishedVersionId: versionId, updatedAt: publishedAt })
        .where(eq(contentItem.id, id))
        .returning()
      await writeAudit("content.publish", "content_item", id, { contentVersionId: versionId })
      const indexed = await indexPublishedContent(id)
      return { item: mapContentItem(published), versionId, documentId: indexed.documentId, chunkCount: indexed.chunkCount }
    },
    async listDocuments() {
      const admin = await ensureAdmin()
      const rows = await db.query.ragDocument.findMany({
        where: eq(ragDocument.tenantId, admin.tenantId),
        orderBy: [desc(ragDocument.indexedAt)],
      })
      return rows.map(mapDocument)
    },
    async listChunks(documentId) {
      const admin = await ensureAdmin()
      const rows = await db.query.ragChunk.findMany({
        where: and(eq(ragChunk.tenantId, admin.tenantId), eq(ragChunk.documentId, documentId)),
        orderBy: [ragChunk.chunkIndex],
      })
      return rows.map(mapChunk)
    },
    async reindexContent(contentItemId) {
      const admin = await ensureAdmin()
      const rows = await db.query.contentItem.findMany({
        where: contentItemId
          ? and(eq(contentItem.tenantId, admin.tenantId), eq(contentItem.id, contentItemId), eq(contentItem.status, "published"))
          : and(eq(contentItem.tenantId, admin.tenantId), eq(contentItem.status, "published")),
      })
      let chunks = 0
      for (const row of rows) chunks += (await indexPublishedContent(row.id)).chunkCount
      return { indexed: rows.length, chunks }
    },
    async search(query, topK = 5) {
      const admin = await ensureAdmin()
      const vector = serializePgVector(embedTextStubHashV1(query))
      const overfetchLimit = Math.max(topK * 25, 100)
      const result = await pool.query<{
        chunk_id: string
        document_id: string
        source_version_id: string
        title: string
        excerpt: string
        distance: string | number
      }>(
        `select c.id as chunk_id,
                c.document_id,
                c.source_version_id,
                d.title,
                left(c.content, 320) as excerpt,
                c.embedding <=> $2::vector as distance
           from rag_chunk c
           join rag_document d on d.id = c.document_id
          where c.tenant_id = $1 and d.status = 'indexed'
          order by c.embedding <=> $2::vector
          limit $3`,
        [admin.tenantId, vector, overfetchLimit],
      )
      return result.rows
        .filter((row) => hasLexicalOverlap(query, `${row.title} ${row.excerpt}`))
        .map((row) => ({
          chunkId: row.chunk_id,
          documentId: row.document_id,
          sourceVersionId: row.source_version_id,
          title: row.title,
          excerpt: row.excerpt,
          score: Number((1 - Number(row.distance)).toFixed(6)),
        }))
        .filter((row) => row.score >= STUB_MIN_RELEVANCE_SCORE)
        .slice(0, topK)
    },
    async createChatSession() {
      const admin = await ensureAdmin()
      const [row] = await db
        .insert(channelConversation)
        .values({
          id: createUuidV7(),
          tenantId: admin.tenantId,
          channel: "website",
          status: "open",
          actionTrace: { lab: true, authMode: "dev-stub" },
        })
        .returning()
      return mapSession(row)
    },
    async listChatSessions() {
      const admin = await ensureAdmin()
      const rows = await db.query.channelConversation.findMany({
        where: eq(channelConversation.tenantId, admin.tenantId),
        orderBy: [desc(channelConversation.createdAt)],
      })
      return rows.map(mapSession)
    },
    async listChatMessages(sessionId) {
      const rows = await db.query.channelMessage.findMany({
        where: eq(channelMessage.conversationId, sessionId),
        orderBy: [channelMessage.createdAt],
      })
      return rows.map(mapMessage)
    },
    async sendChatMessage(input) {
      const session = input.sessionId ? await db.query.channelConversation.findFirst({ where: eq(channelConversation.id, input.sessionId) }) : await this.createChatSession()
      if (!session) throw new Error("Chat session not found")
      const sessionId = session.id
      const topK = input.topK ?? 5
      const sources = await this.search(input.message, topK)
      const answer = composeGroundedAnswer(input.message, sources, topK)
      const admin = await ensureAdmin()
      await db.insert(channelMessage).values({
        id: createUuidV7(),
        tenantId: admin.tenantId,
        conversationId: sessionId,
        direction: "inbound",
        content: input.message,
        sourceIds: [],
        actionTrace: { lab: true },
      })
      await db.insert(channelMessage).values({
        id: createUuidV7(),
        tenantId: admin.tenantId,
        conversationId: sessionId,
        direction: "outbound",
        content: answer.answer,
        sourceIds: answer.sources.map((source) => source.chunkId),
        actionTrace: { lab: true, fallback: answer.fallback, retrieval: answer.retrieval },
      })
      await db.update(channelConversation).set({ lastMessageAt: new Date(), updatedAt: new Date() }).where(eq(channelConversation.id, sessionId))
      await writeAudit("chat_lab.test_message", "channel_conversation", sessionId, { fallback: answer.fallback })
      return { sessionId, ...answer }
    },
  }
}

function mapContentItem(row: typeof contentItem.$inferSelect): ContentItemDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    contentType: row.contentType as ContentType,
    title: row.title,
    slug: row.slug,
    body: row.body,
    status: row.status as ContentStatus,
    metadata: row.metadata,
    publishedVersionId: row.publishedVersionId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function mapDocument(row: typeof ragDocument.$inferSelect): RagDocumentDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    sourceVersionId: row.sourceVersionId,
    title: row.title,
    language: row.language,
    status: row.status,
    chunkCount: row.chunkCount,
    indexedAt: row.indexedAt?.toISOString() ?? null,
  }
}

function mapChunk(row: typeof ragChunk.$inferSelect): RagChunkDto {
  return {
    id: row.id,
    documentId: row.documentId,
    sourceVersionId: row.sourceVersionId,
    chunkIndex: row.chunkIndex,
    section: row.section,
    content: row.content,
    metadata: row.metadata,
    embeddingModel: row.embeddingModel,
    embeddingDimension: row.embeddingDimension,
  }
}

function mapSession(row: typeof channelConversation.$inferSelect): ChatSessionDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    channel: "website",
    status: row.status,
    actionTrace: row.actionTrace,
    lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

function mapMessage(row: typeof channelMessage.$inferSelect): ChatMessageDto {
  return {
    id: row.id,
    conversationId: row.conversationId,
    direction: row.direction,
    messageType: row.messageType,
    content: row.content,
    sourceIds: row.sourceIds,
    actionTrace: row.actionTrace,
    createdAt: row.createdAt.toISOString(),
  }
}

function hasLexicalOverlap(query: string, sourceText: string) {
  const source = sourceText.toLowerCase()
  return queryTokens(query).some((token) => source.includes(token))
}

function queryTokens(query: string) {
  return [...new Set(query.toLowerCase().match(/[a-z0-9]+/g) ?? [])].filter((token) => token.length >= 3)
}

function fallbackAnswer(topK: number): ChatAnswer {
  return {
    answer:
      "I do not have an approved source for that yet in this Phase 1A admin lab. Add or publish content, then reindex and try again.",
    fallback: true,
    sources: [],
    retrieval: { topK, embeddingModel: STUB_EMBEDDING_MODEL },
    leadScore: { score: 0, band: "cold", reasonCodes: [] },
    handoff: null,
  }
}

function isSensitiveQuery(query: string) {
  return /\b(rera|legal|law|approval|approved|possession|handover|price|pricing|cost|discount|loan|mortgage|finance|registration|permit)\b/i.test(query)
}

function sourceSupportsSensitiveQuery(query: string, source: SearchResult) {
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

function parseContentSnapshot(snapshot: Record<string, unknown>) {
  return {
    title: typeof snapshot.title === "string" ? snapshot.title : "Untitled content",
    body: typeof snapshot.body === "string" ? snapshot.body : "",
    contentType: typeof snapshot.contentType === "string" ? snapshot.contentType : "general",
  }
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

function cosineSimilarity(left: readonly number[], right: readonly number[]) {
  let sum = 0
  for (let index = 0; index < left.length; index += 1) sum += left[index] * right[index]
  return sum
}

function excerpt(value: string) {
  return value.length > 320 ? `${value.slice(0, 317)}...` : value
}
