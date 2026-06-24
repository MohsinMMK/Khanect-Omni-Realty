import type { AppConfig } from "@workspace/config"
import {
  createProjectAnswerProvider,
  probeOpenAiEmbeddings,
  resolveProjectEmbeddingApiBaseUrl,
  resolveProjectEmbeddingProvider,
  type ProjectAiSecrets,
} from "@workspace/core"

export async function runProjectEmbeddingSmokeTest(
  secrets: ProjectAiSecrets | null,
  appConfig: AppConfig,
  sample = "Marina Heights pet policy",
) {
  const started = Date.now()
  const provider = resolveProjectEmbeddingProvider(secrets, appConfig.ai)
  const [embedding] = await provider.embedTexts([sample])
  const latencyMs = Date.now() - started

  if (embedding.length !== provider.dimension) {
    throw new Error(`Expected ${provider.dimension} dimensions, received ${embedding.length}`)
  }

  return {
    ok: true,
    provider: provider.mode,
    model: provider.model,
    dimension: provider.dimension,
    latencyMs,
    sampleLength: sample.length,
    vectorPreview: embedding.slice(0, 4).map((value) => Number(value.toFixed(6))),
  }
}

export async function probeProjectEmbedding(
  secrets: ProjectAiSecrets | null,
  appConfig: AppConfig,
  fetchImpl: typeof fetch = fetch,
) {
  const provider = resolveProjectEmbeddingProvider(secrets, appConfig.ai)

  if (provider.mode === "openai") {
    const apiKey = secrets?.embeddingSource === "project"
      ? secrets.embeddingApiKey?.trim()
      : appConfig.ai.openAiApiKey?.trim()
    if (!apiKey) return { ok: false as const, detail: "Embedding API key is not configured for this project." }

    try {
      await probeOpenAiEmbeddings({
        apiKey,
        baseUrl: resolveProjectEmbeddingApiBaseUrl(secrets, appConfig.ai),
        model: provider.model,
        dimension: provider.dimension,
        fetchImpl,
      })
      return { ok: true as const }
    } catch (error) {
      return {
        ok: false as const,
        detail: error instanceof Error ? error.message : "OpenAI embedding probe failed",
      }
    }
  }

  if (provider.mode === "local") {
    const embedderUrl = (secrets?.embeddingSource === "project" ? secrets.embedderUrl : appConfig.ai.embedderUrl)?.replace(/\/$/, "")
    if (!embedderUrl) return { ok: false as const, detail: "Embedder URL is not configured for this project." }

    try {
      const response = await fetchImpl(`${embedderUrl}/health`, { signal: AbortSignal.timeout(3_000) })
      if (!response.ok) return { ok: false as const, detail: `Embedder health returned ${response.status}.` }
      const payload = (await response.json()) as { model?: string; dimension?: number }
      if (payload.model && payload.model !== provider.model) {
        return { ok: false as const, detail: `Embedder is running ${payload.model}, expected ${provider.model}.` }
      }
      if (payload.dimension && payload.dimension !== provider.dimension) {
        return { ok: false as const, detail: `Embedder reports ${payload.dimension} dimensions, expected ${provider.dimension}.` }
      }
      return { ok: true as const }
    } catch (error) {
      return {
        ok: false as const,
        detail: error instanceof Error ? error.message : "Local embedder health check failed",
      }
    }
  }

  return { ok: true as const, detail: "Stub provider is always available in-process." }
}

export async function runProjectLlmSmokeTest(
  secrets: ProjectAiSecrets | null,
  appConfig: AppConfig,
  sample = "Reply with the word OK only.",
  fetchImpl: typeof fetch = fetch,
) {
  const provider = createProjectAnswerProvider(secrets, appConfig.ai, fetchImpl)
  if (!provider) {
    throw new Error("LLM API key is not configured for this project.")
  }

  const started = Date.now()
  const result = await provider({
    message: sample,
    sources: [{ title: "Smoke test", excerpt: "The approved smoke-test answer is OK." }],
  })
  const latencyMs = Date.now() - started

  return {
    ok: true,
    model: result.model,
    latencyMs,
    answerPreview: result.answer.slice(0, 120),
  }
}
