import { readFileSync } from "node:fs"
import { test } from "node:test"
import assert from "node:assert/strict"

const source = readFileSync(
  new URL("../src/features/admin/projects-view.tsx", import.meta.url),
  "utf8",
)

test("new project drawer requires project LLM credentials and healthy local embedding runtime", () => {
  assert.match(source, /llmApiKey/)
  assert.match(source, /LLM API key/)
  assert.match(source, /\/admin\/ai\/embedding/)
  assert.match(source, /Embedding runtime/)
  assert.match(source, /embeddingReady/)
  assert.match(source, /ai-config/)
  assert.match(source, /llm:\s*{\s*source:\s*"project"/s)
  assert.match(source, /disabled={[\s\S]*!llmApiKey\.trim\(\)[\s\S]*!embeddingReady/)
})
