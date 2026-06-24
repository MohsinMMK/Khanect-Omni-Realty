export type Page = "projects" | "content" | "connect" | "conversations" | "settings"
export type ThemePreference = "dark" | "light" | "system"
export type NewBotStepKey = "create" | "knowledge" | "test" | "finish"
export type ProjectAiSource = "platform" | "project"
export type ProjectAiKeySummary = { llmSource: ProjectAiSource; embeddingSource: ProjectAiSource }
export type Project = {
  id: string
  name: string
  domain: string | null
  status: "active" | "archived"
  aiKeys?: ProjectAiKeySummary
}
export type ChatbotCapabilities = { faq: boolean; leadCapture: boolean; appointmentBooking: boolean; propertyRecommendations: boolean }
export type Chatbot = {
  id: string
  projectId: string
  name: string
  purpose: string
  capabilities: ChatbotCapabilities
  status: string
  agentKey?: string
  knowledgeNamespace?: string
  runtimeStatus?: "provisioning" | "live" | "syncing" | "error" | "paused"
  lastIndexedContentVersionId?: string | null
  lastSyncError?: string | null
}
export type ContentItem = { id: string; title: string; slug: string; body: string; status: string; contentType: string; publishedVersionId?: string | null }
export type KnowledgeSource = { id: string; chatbotId?: string; contentItemId?: string; sourceVersionId?: string; title: string; sourceType: string; chunkCount: number; status: string; indexedAt: string }
export type Source = { chunkId: string; title: string; excerpt: string; score: number; sourceType?: string }
export type ChatAnswer = {
  answer: string
  fallback: boolean
  sources: Source[]
  channel: "website" | "whatsapp" | "instagram_dm"
  confidence: string
  actionTrace: Record<string, unknown>
  agentTraceId?: string
}
export type ChatbotRuntimeStatus = {
  chatbotId: string
  runtimeStatus: NonNullable<Chatbot["runtimeStatus"]>
  agno: {
    enabled: boolean
    status: "ok" | "unavailable" | "disabled"
    runtime: string | null
    detail?: string
  }
  model: { source: ProjectAiSource; name: string }
  embedding: { source: ProjectAiSource; provider: EmbeddingProviderMode; status: "ok" | "misconfigured" }
  latest: { agentTraceId: string | null; lastSyncError: string | null }
  capabilities: {
    enabled: Array<keyof ChatbotCapabilities>
    availableTools: string[]
    missingRequirements: Array<{ capabilityId: keyof ChatbotCapabilities; code: string; message: string }>
    ready: boolean
  }
  policyVersion: string
}
export type Connector = { id: string; channel: "website" | "whatsapp" | "instagram_dm"; status: string; displayName: string; config: Record<string, unknown> }
export type ConversationSummary = {
  id: string
  chatbotId: string
  channel: "website" | "whatsapp" | "instagram_dm"
  externalThreadId: string | null
  status: string
  messageCount: number
  lastUserMessage: string | null
  lastAssistantMessage: string | null
  lastMessageAt: string | null
  createdAt: string
  updatedAt: string
}
export type Deployment = { id: string; publicKey: string; allowedDomains: string[]; installStatus: string; installSnippet: string }
export type WidgetPolicy = {
  originProtection: "enforced" | "blocked_until_configured"
  allowedDomains: string[]
  installStatus: string
  rateLimit: { maxMessages: number; windowMs: number; summary: string }
}
export type EmbeddingProviderMode = "stub" | "local" | "openai"
export type EmbeddingModeInfo = {
  id: EmbeddingProviderMode
  label: string
  summary: string
  bestFor: string
  ramHint: string
  costHint: string
  envVars: string[]
}
export type EmbeddingAdminStatus = {
  provider: EmbeddingProviderMode
  model: string
  dimension: number
  enabled: boolean
  configured: boolean
  apiKeyConfigured: boolean
  embedderUrl: string | null
  status: "ok" | "unavailable" | "misconfigured"
  detail?: string
  modes: EmbeddingModeInfo[]
  probe?: { ok: boolean; detail?: string }
}
export type EmbeddingSmokeTestResult = {
  ok: boolean
  provider: EmbeddingProviderMode
  model: string
  dimension: number
  latencyMs: number
  sampleLength: number
  vectorPreview: number[]
}

export type ProjectLlmConfig = {
  source: ProjectAiSource
  apiKeyConfigured: boolean
  apiKeyMasked: string | null
  baseUrl: string | null
  model: string | null
  effectiveBaseUrl: string
  effectiveModel: string
}

export type ProjectEmbeddingConfig = {
  source: ProjectAiSource
  provider: EmbeddingProviderMode
  configuredProvider: EmbeddingProviderMode | null
  apiKeyConfigured: boolean
  apiKeyMasked: string | null
  embedderUrl: string | null
  model: string | null
  dimension: number
  requiresReindex?: boolean
  status: "ok" | "misconfigured"
  detail?: string
  probe?: { ok: boolean; detail?: string }
}

export type ProjectAiConfig = {
  projectId: string
  llm: ProjectLlmConfig
  embedding: ProjectEmbeddingConfig
  updatedAt: string | null
}

export type ProjectLlmSmokeTestResult = {
  ok: boolean
  model: string
  latencyMs: number
  answerPreview: string
}
