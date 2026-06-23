import { readFileSync } from "node:fs"
import { parse } from "yaml"

const contractPath = "Real Estate Web RD/api_contracts.openapi.yaml"
const document = parse(readFileSync(contractPath, "utf8"))

if (document?.openapi !== "3.1.0") {
  throw new Error(`${contractPath} must use OpenAPI 3.1.0`)
}

const requiredPhase1aPaths = [
  ["/health", "get"],
  ["/health/ready", "get"],
  ["/health/clamav", "get"],
  ["/webhooks/meta/whatsapp", "get"],
  ["/webhooks/meta/whatsapp", "post"],
  ["/webhooks/meta/instagram", "get"],
  ["/webhooks/meta/instagram", "post"],
  ["/admin/me", "get"],
  ["/admin/content", "get"],
  ["/admin/content", "post"],
  ["/admin/content/{id}", "patch"],
  ["/admin/content/{id}/publish", "post"],
  ["/admin/rag/documents", "get"],
  ["/admin/rag/documents/{id}/chunks", "get"],
  ["/admin/rag/reindex", "post"],
  ["/admin/rag/search-test", "post"],
  ["/admin/chat-lab/sessions", "get"],
  ["/admin/chat-lab/sessions", "post"],
  ["/admin/chat-lab/sessions/{id}/messages", "get"],
  ["/admin/chat-lab/test-message", "post"],
]

const requiredPlatformPaths = [
  ["/admin/bootstrap", "post"],
  ["/admin/projects", "get"],
  ["/admin/projects", "post"],
  ["/admin/projects/{projectId}/ai-config", "get"],
  ["/admin/projects/{projectId}/ai-config", "patch"],
  ["/admin/projects/{projectId}/ai-config/llm/test", "post"],
  ["/admin/projects/{projectId}/ai-config/embedding/test", "post"],
  ["/admin/projects/{projectId}/chatbots", "get"],
  ["/admin/projects/{projectId}/chatbots", "post"],
  ["/admin/chatbots/{chatbotId}", "get"],
  ["/admin/chatbots/{chatbotId}/content", "get"],
  ["/admin/chatbots/{chatbotId}/content", "post"],
  ["/admin/chatbots/{chatbotId}/content/{contentId}", "patch"],
  ["/admin/chatbots/{chatbotId}/content/{contentId}/publish", "post"],
  ["/admin/chatbots/{chatbotId}/knowledge", "get"],
  ["/admin/chatbots/{chatbotId}/test-message", "post"],
  ["/admin/chatbots/{chatbotId}/connectors", "get"],
  ["/admin/chatbots/{chatbotId}/connectors/website/origin-check", "post"],
  ["/widget/{publicKey}/config", "get"],
  ["/widget/{publicKey}/message", "post"],
]

for (const [path, method] of [...requiredPhase1aPaths, ...requiredPlatformPaths]) {
  if (!document.paths?.[path]?.[method]) {
    throw new Error(`${contractPath} must define ${method.toUpperCase()} ${path}`)
  }
}

const requiredSchemas = [
  "HealthResponse",
  "DependencyHealthResponse",
  "AdminMeResponse",
  "ContentItem",
  "ContentPatchRequest",
  "PublishResponse",
  "RagDocument",
  "RagChunk",
  "RagSource",
  "RetrievalTrace",
  "ChatSession",
  "ChatMessage",
  "ChatAnswerResponse",
  "ChatbotCapabilities",
  "PlatformProject",
  "ProjectAiKeySummary",
  "ProjectAiConfig",
  "ProjectLlmSmokeTestResult",
  "ProjectEmbeddingSmokeTestResult",
  "AdminBootstrapResponse",
  "MetaWebhookProcessResponse",
  "PlatformChatbot",
  "PlatformContentItem",
  "PlatformKnowledgeSource",
  "PlatformPublishResponse",
  "PlatformKnowledgeListResponse",
  "PlatformConnectorsResponse",
  "WidgetSecurityPolicy",
  "WidgetOriginCheckResponse",
  "ReadinessResponse",
  "WidgetConfigResponse",
]

for (const schemaName of requiredSchemas) {
  if (!document.components?.schemas?.[schemaName]) {
    throw new Error(`${contractPath} must define schema ${schemaName}`)
  }
}

const healthSchema = document.components.schemas.HealthResponse
if (!healthSchema?.required?.includes("status")) {
  throw new Error(`${contractPath} HealthResponse must require status`)
}

const dependencyHealthSchema = document.components.schemas.DependencyHealthResponse
if (!dependencyHealthSchema?.required?.includes("dependency")) {
  throw new Error(`${contractPath} DependencyHealthResponse must require dependency`)
}

const publishSchema = document.components.schemas.PublishResponse
if (publishSchema.properties?.embeddingModel?.enum?.[0] !== "stub/hash-v1") {
  throw new Error(`${contractPath} PublishResponse must label stub/hash-v1 embeddings`)
}

const capabilitiesSchema = document.components.schemas.ChatbotCapabilities
if (!capabilitiesSchema?.required?.includes("propertyRecommendations")) {
  throw new Error(`${contractPath} ChatbotCapabilities must include propertyRecommendations`)
}

console.log("openapi contract ok")