import type { AppConfig } from "@workspace/config"
import {
  BGE_BASE_EN_V15_EMBEDDING_MODEL,
  BGE_SMALL_EN_V15_EMBEDDING_MODEL,
  OPENAI_EMBEDDING_MODEL,
  STUB_EMBEDDING_MODEL,
  createEmbeddingProviderFromAppAiConfig,
  probeOpenAiEmbeddings,
  type EmbeddingProviderMode,
} from "@workspace/core"

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
}

const embeddingModes: EmbeddingModeInfo[] = [
  {
    id: "stub",
    label: "Stub (dev)",
    summary: "Deterministic hash vectors for smoke tests. No semantic search quality.",
    bestFor: "Local development without external services.",
    ramHint: "Negligible RAM.",
    costHint: "Free.",
    envVars: ["EMBEDDING_PROVIDER=stub"],
  },
  {
    id: "openai",
    label: "OpenAI API",
    summary: "Hosted embeddings via text-embedding-3-small at 1024 dimensions (Matryoshka).",
    bestFor: "Low-RAM VPS production — uses your OpenAI credits, no local model load.",
    ramHint: "No embedder RAM on your server.",
    costHint: "About $0.02 per 1M tokens (~$5 credit ≈ 250M tokens).",
    envVars: [
      "EMBEDDING_PROVIDER=openai",
      "OPENAI_API_KEY=sk-...",
      "EMBEDDING_DIMENSION=1024",
    ],
  },
  {
    id: "local",
    label: "Local BGE v1.5",
    summary: "Self-hosted rag-embedder with BGE small or BGE base presets.",
    bestFor: "Production RAG on an 8 GB VPS without paid embedding APIs.",
    ramHint: "BGE small is lowest RAM; BGE base is the recommended quality default.",
    costHint: "VPS cost only; no per-token API fees.",
    envVars: [
      "EMBEDDING_PROVIDER=local",
      "EMBEDDER_URL=http://rag-embedder:8080",
      `EMBEDDING_MODEL=${BGE_BASE_EN_V15_EMBEDDING_MODEL}`,
    ],
  },
]

export function buildEmbeddingAdminStatus(config: AppConfig): EmbeddingAdminStatus {
  const { ai } = config
  const provider = ai.embeddingProvider
  const model = provider === "openai"
    ? ai.openAiEmbeddingModel
    : provider === "local"
      ? ai.embeddingModel
      : STUB_EMBEDDING_MODEL

  const apiKeyConfigured = Boolean(ai.openAiApiKey?.trim())
  const embedderUrl = ai.embedderUrl ?? null

  let configured = true
  let detail: string | undefined

  if (provider === "openai" && !apiKeyConfigured) {
    configured = false
    detail = "Set OPENAI_API_KEY or LLM_API_KEY when EMBEDDING_PROVIDER=openai."
  }

  if (provider === "local" && !embedderUrl) {
    configured = false
    detail = "Set EMBEDDER_URL when EMBEDDING_PROVIDER=local."
  }

  return {
    provider,
    model,
    dimension: ai.embeddingDimension,
    enabled: ai.embeddingEnabled,
    configured,
    apiKeyConfigured,
    embedderUrl,
    status: configured ? "ok" : "misconfigured",
    detail,
    modes: embeddingModes.map((mode) => ({
      ...mode,
      envVars: mode.id === "openai"
        ? [...mode.envVars, `EMBEDDING_MODEL=${OPENAI_EMBEDDING_MODEL}`]
        : mode.id === "local"
          ? [...mode.envVars, `EMBEDDING_MODEL=${BGE_BASE_EN_V15_EMBEDDING_MODEL} or ${BGE_SMALL_EN_V15_EMBEDDING_MODEL}`]
          : mode.envVars,
    })),
  }
}

export async function probeEmbeddingProvider(config: AppConfig, fetchImpl: typeof fetch = fetch) {
  const { ai } = config

  if (ai.embeddingProvider === "openai") {
    const apiKey = ai.openAiApiKey?.trim()
    if (!apiKey) return { ok: false as const, detail: "OpenAI API key is not configured." }

    try {
      await probeOpenAiEmbeddings({
        apiKey,
        baseUrl: ai.openAiBaseUrl,
        model: ai.openAiEmbeddingModel,
        dimension: ai.embeddingDimension,
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

  if (ai.embeddingProvider === "local") {
    const embedderUrl = ai.embedderUrl?.replace(/\/$/, "")
    if (!embedderUrl) return { ok: false as const, detail: "EMBEDDER_URL is not configured." }

    try {
      const response = await fetchImpl(`${embedderUrl}/health`, { signal: AbortSignal.timeout(3_000) })
      if (!response.ok) return { ok: false as const, detail: `Embedder health returned ${response.status}.` }
      const payload = (await response.json()) as { status?: string; model?: string; dimension?: number }
      if (payload.status !== "ok") return { ok: false as const, detail: "Embedder health check did not report ok." }
      if (payload.dimension && payload.dimension !== ai.embeddingDimension) {
        return { ok: false as const, detail: `Embedder reports ${payload.dimension} dimensions, expected ${ai.embeddingDimension}.` }
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

export async function runEmbeddingSmokeTest(config: AppConfig, sample = "Marina Heights pet policy") {
  const started = Date.now()
  const provider = createEmbeddingProviderFromAppAiConfig(config.ai)
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
