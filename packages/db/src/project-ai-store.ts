import type { AppConfig } from "@workspace/config"
import {
  buildProjectAiConfigDto,
  decryptSecret,
  encryptSecret,
  getLocalEmbeddingPresetByModel,
  type EmbeddingProvider,
  type EmbeddingProviderMode,
  type ProjectAiConfigDto,
  type ProjectAiConfigUpdateInput,
  type ProjectAiRuntimeResolver,
  type ProjectAiSecrets,
  type ProjectAiSource,
  type ProjectAnswerProvider,
  type ProjectLlmRuntimeConfig,
  resolveProjectLlmRuntime,
} from "@workspace/core"
import { and, eq } from "drizzle-orm"
import type { Pool } from "pg"

import type { AppDb } from "./index.js"
import { projectAiConfig } from "./schema.js"
interface RuntimeAnswerProviderInput {
  message: string
  sources: Array<{ title: string; excerpt: string; chunkId?: string; knowledgeSourceId?: string; score?: number }>
  chatbot: unknown
  chatbotId: string
  channel: string
  policy?: unknown
  llmConfig?: ProjectLlmRuntimeConfig
}

interface RuntimeAnswerProviderResult {
  answer: string
  model: string
  confidence?: "none" | "low" | "medium" | "high"
  actionTrace?: Record<string, unknown>
  agentTraceId?: string
}

export type RuntimeAnswerProvider = (input: RuntimeAnswerProviderInput) => Promise<RuntimeAnswerProviderResult>

export interface ProjectAiRecord {
  projectId: string
  llmSource: ProjectAiSource
  llmApiKey?: string
  llmBaseUrl?: string | null
  llmModel?: string | null
  embeddingSource: ProjectAiSource
  embeddingProvider?: EmbeddingProviderMode | null
  embeddingApiKey?: string
  embedderUrl?: string | null
  embeddingModel?: string | null
  embeddingDimension?: number | null
  updatedAt: string
}

export interface ProjectAiKeySummary {
  llmSource: ProjectAiSource
  embeddingSource: ProjectAiSource
}

export const DEFAULT_PROJECT_AI_KEY_SUMMARY: ProjectAiKeySummary = {
  llmSource: "platform",
  embeddingSource: "platform",
}

export function mapProjectAiKeySummary(record: ProjectAiRecord | null | undefined): ProjectAiKeySummary {
  return {
    llmSource: record?.llmSource ?? "platform",
    embeddingSource: record?.embeddingSource ?? "platform",
  }
}

export interface ProjectAiStoreContext {
  appConfig: AppConfig
  encryptionKey: string
  projectAiResolver?: ProjectAiRuntimeResolver
  defaultEmbeddingProvider: EmbeddingProvider
  defaultAnswerProvider?: RuntimeAnswerProvider
  answerProviderPriority?: "project" | "default"
}

function toSecrets(record: ProjectAiRecord | null, projectId: string): ProjectAiSecrets | null {
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
    embedderUrl: record.embedderUrl ?? undefined,
    embeddingModel: record.embeddingModel ?? undefined,
    embeddingDimension: record.embeddingDimension ?? undefined,
  }
}

export function mapProjectAiConfigDto(
  record: ProjectAiRecord | null,
  appConfig: AppConfig,
  projectId: string,
): ProjectAiConfigDto {
  return buildProjectAiConfigDto(toSecrets(record, projectId), appConfig.ai, projectId, record?.updatedAt ?? null)
}

export function applyProjectAiUpdate(
  existing: ProjectAiRecord | null,
  input: ProjectAiConfigUpdateInput,
  projectId: string,
  encryptionKey: string,
  encrypt = true,
): ProjectAiRecord {
  const timestamp = new Date().toISOString()
  const next: ProjectAiRecord = existing ?? {
    projectId,
    llmSource: "platform",
    embeddingSource: "platform",
    updatedAt: timestamp,
  }

  if (input.llm) {
    if (input.llm.source) next.llmSource = input.llm.source
    if (input.llm.baseUrl !== undefined) next.llmBaseUrl = input.llm.baseUrl
    if (input.llm.model !== undefined) next.llmModel = input.llm.model
    if (input.llm.apiKey !== undefined) {
      const trimmed = input.llm.apiKey?.trim()
      next.llmApiKey = trimmed
        ? encrypt
          ? encryptSecret(trimmed, encryptionKey)
          : trimmed
        : undefined
    }
  }

  if (input.embedding) {
    if (input.embedding.source) next.embeddingSource = input.embedding.source
    if (input.embedding.provider !== undefined) next.embeddingProvider = input.embedding.provider
    if (input.embedding.embedderUrl !== undefined) next.embedderUrl = input.embedding.embedderUrl
    if (input.embedding.model !== undefined) next.embeddingModel = input.embedding.model
    if (next.embeddingSource === "project" && next.embeddingProvider === "local") {
      const preset = getLocalEmbeddingPresetByModel(next.embeddingModel)
      if (!preset) {
        throw new Error("Unsupported local embedding model. Choose BGE small or BGE base.")
      }
      next.embeddingModel = preset.model
      next.embeddingDimension = preset.dimension
    } else if (input.embedding.dimension !== undefined) {
      next.embeddingDimension = input.embedding.dimension
    }
    if (input.embedding.apiKey !== undefined) {
      const trimmed = input.embedding.apiKey?.trim()
      next.embeddingApiKey = trimmed
        ? encrypt
          ? encryptSecret(trimmed, encryptionKey)
          : trimmed
        : undefined
    }
  }

  next.updatedAt = timestamp
  return next
}

function decryptRecord(record: ProjectAiRecord, encryptionKey: string): ProjectAiRecord {
  return {
    ...record,
    llmApiKey: record.llmApiKey ? decryptSecret(record.llmApiKey, encryptionKey) : undefined,
    embeddingApiKey: record.embeddingApiKey ? decryptSecret(record.embeddingApiKey, encryptionKey) : undefined,
  }
}

export function mapRowToProjectAiRecord(row: {
  projectId: string
  llmSource: string
  llmApiKeyEncrypted: string | null
  llmBaseUrl: string | null
  llmModel: string | null
  embeddingSource: string
  embeddingProvider: string | null
  embeddingApiKeyEncrypted: string | null
  embedderUrl: string | null
  embeddingModel: string | null
  embeddingDimension: number | null
  updatedAt: Date
}): ProjectAiRecord {
  return {
    projectId: row.projectId,
    llmSource: row.llmSource as ProjectAiSource,
    llmApiKey: row.llmApiKeyEncrypted ?? undefined,
    llmBaseUrl: row.llmBaseUrl,
    llmModel: row.llmModel,
    embeddingSource: row.embeddingSource as ProjectAiSource,
    embeddingProvider: row.embeddingProvider as EmbeddingProviderMode | null,
    embeddingApiKey: row.embeddingApiKeyEncrypted ?? undefined,
    embedderUrl: row.embedderUrl,
    embeddingModel: row.embeddingModel,
    embeddingDimension: row.embeddingDimension,
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function loadProjectAiSecretsFromDb(
  db: AppDb,
  tenantId: string,
  projectId: string,
  encryptionKey: string,
): Promise<ProjectAiSecrets | null> {
  const row = await db.query.projectAiConfig.findFirst({
    where: and(eq(projectAiConfig.tenantId, tenantId), eq(projectAiConfig.projectId, projectId)),
  })
  if (!row) return null
  const record = decryptRecord(mapRowToProjectAiRecord(row), encryptionKey)
  return toSecrets(record, projectId)
}

export async function upsertProjectAiRecord(
  db: AppDb,
  tenantId: string,
  record: ProjectAiRecord,
): Promise<ProjectAiRecord> {
  const [row] = await db
    .insert(projectAiConfig)
    .values({
      projectId: record.projectId,
      tenantId,
      llmSource: record.llmSource,
      llmApiKeyEncrypted: record.llmApiKey ?? null,
      llmBaseUrl: record.llmBaseUrl ?? null,
      llmModel: record.llmModel ?? null,
      embeddingSource: record.embeddingSource,
      embeddingProvider: record.embeddingProvider ?? null,
      embeddingApiKeyEncrypted: record.embeddingApiKey ?? null,
      embedderUrl: record.embedderUrl ?? null,
      embeddingModel: record.embeddingModel ?? null,
      embeddingDimension: record.embeddingDimension ?? null,
      updatedAt: new Date(record.updatedAt),
    })
    .onConflictDoUpdate({
      target: projectAiConfig.projectId,
      set: {
        llmSource: record.llmSource,
        llmApiKeyEncrypted: record.llmApiKey ?? null,
        llmBaseUrl: record.llmBaseUrl ?? null,
        llmModel: record.llmModel ?? null,
        embeddingSource: record.embeddingSource,
        embeddingProvider: record.embeddingProvider ?? null,
        embeddingApiKeyEncrypted: record.embeddingApiKey ?? null,
        embedderUrl: record.embedderUrl ?? null,
        embeddingModel: record.embeddingModel ?? null,
        embeddingDimension: record.embeddingDimension ?? null,
        updatedAt: new Date(record.updatedAt),
      },
    })
    .returning()

  return mapRowToProjectAiRecord(row)
}

export async function deleteProjectAiRecord(db: AppDb, tenantId: string, projectId: string, pool?: Pool) {
  if (pool) {
    await pool.query(`delete from project_ai_config where tenant_id = $1 and project_id = $2`, [tenantId, projectId])
    return
  }
  await db.delete(projectAiConfig).where(and(eq(projectAiConfig.tenantId, tenantId), eq(projectAiConfig.projectId, projectId)))
}

function wrapProjectAnswerProvider(provider: ProjectAnswerProvider): RuntimeAnswerProvider {
  return async (input) => {
    const result = await provider({
      message: input.message,
      sources: input.sources,
    })
    return {
      answer: result.answer,
      model: result.model,
    }
  }
}

function wrapDefaultAnswerProvider(provider: RuntimeAnswerProvider): RuntimeAnswerProvider {
  return provider
}

export async function resolveProjectRuntimeProviders(
  projectId: string,
  context: ProjectAiStoreContext,
): Promise<{ embeddingProvider: EmbeddingProvider; answerProvider?: RuntimeAnswerProvider; llmConfig?: ProjectLlmRuntimeConfig }> {
  if (context.projectAiResolver) {
    const [embeddingProvider, projectAnswerProvider, llmConfig] = await Promise.all([
      context.projectAiResolver.resolveEmbeddingProvider(projectId),
      context.projectAiResolver.resolveAnswerProvider(projectId),
      context.projectAiResolver.resolveLlmConfig(projectId),
    ])
    const defaultProvider = context.defaultAnswerProvider ? wrapDefaultAnswerProvider(context.defaultAnswerProvider) : undefined
    const projectProvider = projectAnswerProvider ? wrapProjectAnswerProvider(projectAnswerProvider) : undefined
    return {
      embeddingProvider,
      answerProvider: context.answerProviderPriority === "default"
        ? defaultProvider ?? projectProvider
        : projectProvider ?? defaultProvider,
      llmConfig,
    }
  }

  return {
    embeddingProvider: context.defaultEmbeddingProvider,
    answerProvider: context.defaultAnswerProvider
      ? wrapDefaultAnswerProvider(context.defaultAnswerProvider)
      : undefined,
    llmConfig: resolveProjectLlmRuntime(null, context.appConfig.ai),
  }
}
