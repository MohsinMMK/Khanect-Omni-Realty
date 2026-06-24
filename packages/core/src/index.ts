import { v7 as uuidv7, validate as validateUuid, version as uuidVersion } from "uuid"

export {
  AGENT_CAPABILITY_POLICY_VERSION,
  agentCapabilityCatalog,
  buildAgentCapabilityPolicy,
  getEnabledAgentCapabilityIds,
  normalizeAgentCapabilities,
  validateAgentCapabilities,
  type AgentCapabilities,
  type AgentCapabilityId,
  type AgentCapabilityMissingRequirement,
  type AgentCapabilityPolicy,
  type AgentCapabilityValidation,
  type AgentSourceType,
  type AgentToolId,
} from "./agent-capabilities.js"
export {
  getSupportedDocumentUploadFormat,
  supportedDocumentUploadAccept,
  supportedDocumentUploadFormats,
  type DocumentUploadFormat,
  type DocumentUploadKind,
} from "./document-upload.js"
export {
  BGE_M3_EMBEDDING_MODEL,
  BGE_BASE_EN_V15_DIMENSION,
  BGE_BASE_EN_V15_EMBEDDING_MODEL,
  BGE_SMALL_EN_V15_DIMENSION,
  BGE_SMALL_EN_V15_EMBEDDING_MODEL,
  EMBEDDING_DIMENSION,
  OPENAI_EMBEDDING_MODEL,
  STUB_EMBEDDING_MODEL,
  createEmbeddingProviderFromAppAiConfig,
  createEmbeddingProviderFromConfig,
  createHttpEmbeddingProvider,
  createOpenAiEmbeddingProvider,
  createStubEmbeddingProvider,
  embedTextStubHashV1,
  getLocalEmbeddingPresetByModel,
  isSupportedLocalEmbeddingModel,
  localEmbeddingModelPresets,
  probeOpenAiEmbeddings,
  requireRealEmbeddingProvider,
  resolveEmbeddingDimension,
  type AppAiEmbeddingConfig,
  type EmbeddingProvider,
  type EmbeddingProviderConfig,
  type EmbeddingModelPreset,
  type EmbeddingModelPresetId,
  type EmbeddingProviderMode,
  type HttpEmbeddingProviderOptions,
  type OpenAiEmbeddingProviderOptions,
} from "./embedding.js"
export { createRedisConnectionOptions, type RedisConnectionOptions } from "./redis.js"
export {
  listOpencodeLlmPresetsByPlan,
  openAiCompatibleEmbeddingPresets,
  opencodeGoLlmPresets,
  opencodeLlmPresets,
  opencodeZenLlmPresets,
  OPENCODE_GO_BASE_URL,
  OPENCODE_ZEN_BASE_URL,
  OPENAI_COMPATIBLE_EMBEDDINGS_BASE_URL,
  recommendedEmbeddingPreset,
  recommendedOpencodeLlmPreset,
  type AiProviderPreset,
  type OpenCodeLlmPlan,
} from "./ai-provider-catalog.js"
export {
  buildOpenCodeModelCatalog,
  createOpenCodeModelCatalogCache,
  fetchOpenCodeModelIds,
  formatOpenCodeModelLabel,
  isOpenCodeGoModelSupported,
  isOpenCodeModelSupported,
  isOpenCodeZenModelSupported,
  loadOpenCodeModelCatalog,
  OPENCODE_GO_RECOMMENDED_MODEL,
  OPENCODE_GO_MESSAGES_ONLY_MODELS,
  OPENCODE_ZEN_RECOMMENDED_MODEL,
  toAiProviderPresets,
  type OpenCodeModelCatalog,
  type OpenCodeModelCatalogCache,
  type OpenCodeModelCatalogEntry,
} from "./opencode-models.js"
export {
  buildProjectAiConfigDto,
  createProjectAiRuntimeResolver,
  createProjectAnswerProvider,
  joinBaseUrlPath,
  resolveProjectLlmRuntime,
  resolveProjectEmbeddingApiBaseUrl,
  resolveProjectEmbeddingProvider,
  type ProjectAiConfigDto,
  type ProjectAiConfigUpdateInput,
  type ProjectAiRuntimeResolver,
  type ProjectAiPlatformConfig,
  type ProjectAiSecrets,
  type ProjectLlmRuntimeConfig,
  type ProjectAiSource,
  type ProjectAnswerProvider,
  type ProjectEmbeddingConfigDto,
  type ProjectLlmConfigDto,
} from "./project-ai.js"
export { decryptSecret, encryptSecret, maskSecret } from "./secrets.js"
export {
  buildPlatformRagIndexJobId,
  isPlatformRagIndexJob,
  ragIndexQueueName,
  type LegacyRagIndexJobPayload,
  type RagIndexJobData,
  type RagIndexJobPayload,
} from "./rag-index.js"

export type UuidV7 = string & { readonly __brand: "uuid-v7" }

export function createUuidV7(): UuidV7 {
  return uuidv7() as UuidV7
}

export function isUuidV7(value: string): value is UuidV7 {
  return validateUuid(value) && uuidVersion(value) === 7
}

export type Channel = "website" | "whatsapp" | "instagram_dm"
export type MessageDirection = "inbound" | "outbound" | "system"
export type ChannelMessageType = "text" | "image" | "document" | "interactive" | "unknown"

export interface ChannelIdentity {
  tenantId: UuidV7 | string
  channel: Channel
  externalUserId?: string
  externalThreadId?: string
  anonymousSessionId?: string
  consentTextVersion?: string
}

export interface ChannelInboundEvent {
  id: UuidV7
  receivedAt: Date
  identity: ChannelIdentity
  externalMessageId?: string
  messageType: ChannelMessageType
  text?: string
  rawPayload?: unknown
}

export interface ChannelOutboundMessage {
  conversationId: UuidV7 | string
  channel: Channel
  text: string
  sourceIds?: string[]
  actionTrace?: Record<string, unknown>
}

export interface ChannelSendResult {
  accepted: boolean
  externalMessageId?: string
  reason?: string
}

export interface ChannelAdapter {
  readonly channel: Channel
  verifyWebhook?(input: WebhookVerificationInput): Promise<boolean> | boolean
  normalizeInbound(input: WebhookInboundInput): Promise<ChannelInboundEvent[]> | ChannelInboundEvent[]
  sendReply(message: ChannelOutboundMessage): Promise<ChannelSendResult>
}

export interface WebhookVerificationInput {
  method: "GET" | "POST"
  headers: Record<string, string | string[] | undefined>
  query?: Record<string, string | undefined>
  body?: unknown
}

export interface WebhookInboundInput {
  headers: Record<string, string | string[] | undefined>
  body: unknown
  receivedAt: Date
}

export interface EgiPipelineInput {
  event: ChannelInboundEvent
  tenantId: UuidV7 | string
}

export interface EgiPipelineResult {
  conversationId: UuidV7 | string
  reply?: ChannelOutboundMessage
  leadScore?: LeadScoreResult
  handoff?: HumanHandoffRequest
  actionTrace: Record<string, unknown>
}

export type LeadScoreBand = "cold" | "warm" | "hot" | "urgent"

export interface LeadScoreSignal {
  code: string
  weight: number
  evidence?: string
}

export interface LeadScoreResult {
  score: number
  band: LeadScoreBand
  reasonCodes: string[]
  signals: LeadScoreSignal[]
  recommendedAction: "auto_reply" | "nurture" | "sales_follow_up" | "urgent_handoff"
}

export type HandoffReason =
  | "high_intent"
  | "low_confidence"
  | "legal_or_financial_question"
  | "complaint"
  | "user_requested_human"
  | "policy_required"

export interface HumanHandoffRequest {
  tenantId: UuidV7 | string
  conversationId: UuidV7 | string
  leadId?: UuidV7 | string
  reason: HandoffReason
  summary: string
  priority: "normal" | "high" | "urgent"
}

export type AuditAction =
  | "auth.stub"
  | "channel.event.received"
  | "egi.response.generated"
  | "lead.score.updated"
  | "handoff.created"
  | "db.migration.generated"

export interface AuditLogEntry {
  tenantId?: UuidV7 | string
  actorId?: UuidV7 | string
  action: AuditAction | (string & {})
  entityType?: string
  entityId?: UuidV7 | string
  metadata?: Record<string, unknown>
  createdAt: Date
}

export interface AuditLogWriter {
  write(entry: AuditLogEntry): Promise<void>
}

export interface AuthContextStub {
  tenantId?: UuidV7 | string
  userId?: UuidV7 | string
  roles: string[]
  isAuthenticated: boolean
}
