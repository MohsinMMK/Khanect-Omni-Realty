import { readFileSync } from "node:fs"
import { parse } from "yaml"

const contractPath = "Real Estate Web RD/api_contracts.openapi.yaml"
const document = parse(readFileSync(contractPath, "utf8"))

if (document?.openapi !== "3.1.0") {
  throw new Error(`${contractPath} must use OpenAPI 3.1.0`)
}

const requiredPaths = [
  ["/health", "get"],
  ["/health/clamav", "get"],
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

for (const [path, method] of requiredPaths) {
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

console.log("openapi contract ok")
