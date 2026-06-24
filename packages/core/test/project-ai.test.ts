import { describe, expect, it } from "vitest"

import {
  BGE_BASE_EN_V15_DIMENSION,
  BGE_BASE_EN_V15_EMBEDDING_MODEL,
  BGE_SMALL_EN_V15_DIMENSION,
  BGE_SMALL_EN_V15_EMBEDDING_MODEL,
} from "../src/embedding.js"
import {
  buildProjectAiConfigDto,
  createProjectAnswerProvider,
  resolveProjectEmbeddingProvider,
  type ProjectAiPlatformConfig,
  type ProjectAiSecrets,
} from "../src/project-ai.js"

const platformConfig: ProjectAiPlatformConfig = {
  embeddingProvider: "openai",
  embeddingModel: "BAAI/bge-m3",
  embeddingDimension: 1024,
  openAiApiKey: "sk-platform-embed",
  openAiBaseUrl: "https://api.openai.com/v1",
  openAiEmbeddingModel: "text-embedding-3-small",
  llmBaseUrl: "https://api.openai.com/v1",
  llmApiKey: "sk-platform-llm",
  llmModel: "gpt-4o-mini",
}

const projectSecrets: ProjectAiSecrets = {
  projectId: "0194f0a0-0000-7000-8000-000000000001",
  llmSource: "project",
  llmApiKey: "sk-project-llm",
  llmBaseUrl: "https://api.openai.com/v1",
  llmModel: "gpt-4.1-mini",
  embeddingSource: "project",
  embeddingProvider: "openai",
  embeddingApiKey: "sk-project-embed",
  embeddingModel: "text-embedding-3-small",
}

describe("project-ai", () => {
  it("builds separate masked llm and embedding sections", () => {
    const dto = buildProjectAiConfigDto(projectSecrets, platformConfig, projectSecrets.projectId)
    expect(dto.llm.source).toBe("project")
    expect(dto.llm.apiKeyMasked).toContain("…")
    expect(dto.embedding.source).toBe("project")
    expect(dto.embedding.apiKeyMasked).not.toBe(dto.llm.apiKeyMasked)
    expect(dto.embedding.status).toBe("ok")
  })

  it("falls back to platform keys when source is platform", () => {
    const dto = buildProjectAiConfigDto(
      { ...projectSecrets, llmSource: "platform", embeddingSource: "platform" },
      platformConfig,
      projectSecrets.projectId,
    )
    expect(dto.llm.source).toBe("platform")
    expect(dto.embedding.source).toBe("platform")
    expect(dto.llm.apiKeyConfigured).toBe(true)
    expect(dto.embedding.apiKeyConfigured).toBe(true)
  })

  it("resolves project-scoped embedding provider mode", () => {
    const provider = resolveProjectEmbeddingProvider(projectSecrets, platformConfig)
    expect(provider.mode).toBe("openai")
    expect(provider.model).toBe("text-embedding-3-small")
  })

  it("resolves local BGE project presets to their catalog dimensions", () => {
    const small = buildProjectAiConfigDto(
      {
        ...projectSecrets,
        embeddingProvider: "local",
        embedderUrl: "http://localhost:8080",
        embeddingModel: BGE_SMALL_EN_V15_EMBEDDING_MODEL,
      },
      platformConfig,
      projectSecrets.projectId,
    )
    const base = buildProjectAiConfigDto(
      {
        ...projectSecrets,
        embeddingProvider: "local",
        embedderUrl: "http://localhost:8080",
        embeddingModel: BGE_BASE_EN_V15_EMBEDDING_MODEL,
      },
      platformConfig,
      projectSecrets.projectId,
    )

    expect(small.embedding.dimension).toBe(BGE_SMALL_EN_V15_DIMENSION)
    expect(base.embedding.dimension).toBe(BGE_BASE_EN_V15_DIMENSION)
  })

  it("creates project answer provider only when llm key exists", () => {
    expect(createProjectAnswerProvider(projectSecrets, platformConfig)).toBeDefined()
    expect(
      createProjectAnswerProvider(
        { ...projectSecrets, llmSource: "project", llmApiKey: undefined },
        platformConfig,
      ),
    ).toBeUndefined()
  })

  it("preserves the OpenAI /v1 base path when calling chat completions", async () => {
    let requestedUrl = ""
    const provider = createProjectAnswerProvider(projectSecrets, platformConfig, async (input) => {
      requestedUrl = String(input)
      return new Response(JSON.stringify({ choices: [{ message: { content: "OK" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    })

    await provider?.({
      message: "Reply OK.",
      sources: [{ title: "Smoke", excerpt: "Reply OK from this approved source." }],
    })

    expect(requestedUrl).toBe("https://api.openai.com/v1/chat/completions")
  })
})
