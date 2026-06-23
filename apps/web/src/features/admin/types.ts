export type Page = "projects" | "content" | "connect" | "settings"
export type ThemePreference = "dark" | "light" | "system"
export type NewBotStepKey = "create" | "knowledge" | "test" | "finish"
export type Project = { id: string; name: string; domain: string | null; status: "active" | "archived" }
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
  runtimeStatus?: "ready" | "syncing" | "error" | "paused"
  lastIndexedContentVersionId?: string | null
  lastSyncError?: string | null
}
export type ContentItem = { id: string; title: string; slug: string; body: string; status: string; contentType: string; publishedVersionId?: string | null }
export type KnowledgeSource = { id: string; chatbotId?: string; contentItemId?: string; sourceVersionId?: string; title: string; sourceType: string; chunkCount: number; status: string; indexedAt: string }
export type Source = { chunkId: string; title: string; excerpt: string; score: number }
export type ChatAnswer = {
  answer: string
  fallback: boolean
  sources: Source[]
  channel: "website" | "whatsapp" | "instagram_dm"
  confidence: string
  actionTrace: Record<string, unknown>
  agentTraceId?: string
}
export type Connector = { id: string; channel: "website" | "whatsapp" | "instagram_dm"; status: string; displayName: string; config: Record<string, unknown> }
export type Deployment = { id: string; publicKey: string; allowedDomains: string[]; installStatus: string; installSnippet: string }