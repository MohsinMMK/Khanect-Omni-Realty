import { describe, expect, it } from "vitest"

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

  it("creates project answer provider only when llm key exists", () => {
    expect(createProjectAnswerProvider(projectSecrets, platformConfig)).toBeDefined()
    expect(
      createProjectAnswerProvider(
        { ...projectSecrets, llmSource: "project", llmApiKey: undefined },
        platformConfig,
      ),
    ).toBeUndefined()
  })
})