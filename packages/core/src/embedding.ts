export const STUB_EMBEDDING_MODEL = "stub/hash-v1"
export const BGE_M3_EMBEDDING_MODEL = "BAAI/bge-m3"
export const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small"
export const EMBEDDING_DIMENSION = 1024

export type EmbeddingProviderMode = "stub" | "local" | "openai"

export interface EmbeddingProvider {
  readonly model: string
  readonly dimension: number
  readonly mode: EmbeddingProviderMode
  embedTexts(texts: string[]): Promise<number[][]>
}

export function embedTextStubHashV1(input: string): number[] {
  const buckets = new Float64Array(EMBEDDING_DIMENSION)
  const normalized = input.normalize("NFKC").toLowerCase().trim()
  const tokens = normalized.match(/[\p{L}\p{N}]+/gu) ?? [normalized]

  for (const token of tokens) {
    let hash = 2166136261
    for (let index = 0; index < token.length; index += 1) {
      hash ^= token.charCodeAt(index)
      hash = Math.imul(hash, 16777619) >>> 0
    }

    const bucket = hash % EMBEDDING_DIMENSION
    const sign = (hash & 1) === 0 ? 1 : -1
    buckets[bucket] += sign * Math.max(1, token.length / 8)
  }

  let magnitude = 0
  for (const value of buckets) magnitude += value * value
  magnitude = Math.sqrt(magnitude) || 1

  return Array.from(buckets, (value) => Number((value / magnitude).toFixed(8)))
}

export function createStubEmbeddingProvider(): EmbeddingProvider {
  return {
    model: STUB_EMBEDDING_MODEL,
    dimension: EMBEDDING_DIMENSION,
    mode: "stub",
    async embedTexts(texts) {
      return texts.map((text) => embedTextStubHashV1(text))
    },
  }
}

export interface HttpEmbeddingProviderOptions {
  baseUrl: string
  model?: string
  dimension?: number
  fetchImpl?: typeof fetch
}

interface OpenAiEmbeddingsResponse {
  data?: Array<{ embedding?: number[] }>
}

function validateEmbeddings(embeddings: Array<number[] | undefined>, dimension: number, texts: string[]) {
  if (embeddings.length !== texts.length) {
    throw new Error("embedder response missing embedding data")
  }

  const validated: number[][] = []
  for (const embedding of embeddings) {
    if (!embedding || embedding.length !== dimension || embedding.some((value) => !Number.isFinite(value))) {
      throw new Error(`embedder returned invalid ${dimension}-dimension vectors`)
    }
    validated.push(embedding)
  }

  return validated
}

export function createHttpEmbeddingProvider(options: HttpEmbeddingProviderOptions): EmbeddingProvider {
  const model = options.model ?? BGE_M3_EMBEDDING_MODEL
  const dimension = options.dimension ?? EMBEDDING_DIMENSION
  const fetchImpl = options.fetchImpl ?? fetch
  const baseUrl = options.baseUrl.replace(/\/$/, "")

  return {
    model,
    dimension,
    mode: "local",
    async embedTexts(texts) {
      const response = await fetchImpl(`${baseUrl}/v1/embeddings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model, input: texts }),
      })

      if (!response.ok) {
        throw new Error(`embedder request failed with status ${response.status}`)
      }

      const payload = (await response.json()) as OpenAiEmbeddingsResponse
      const embeddings = payload.data?.map((entry) => entry.embedding) ?? []
      return validateEmbeddings(embeddings, dimension, texts)
    },
  }
}

export interface OpenAiEmbeddingProviderOptions {
  apiKey: string
  baseUrl?: string
  model?: string
  dimension?: number
  fetchImpl?: typeof fetch
}

export function createOpenAiEmbeddingProvider(options: OpenAiEmbeddingProviderOptions): EmbeddingProvider {
  const model = options.model ?? OPENAI_EMBEDDING_MODEL
  const dimension = options.dimension ?? EMBEDDING_DIMENSION
  const fetchImpl = options.fetchImpl ?? fetch
  const baseUrl = (options.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "")

  return {
    model,
    dimension,
    mode: "openai",
    async embedTexts(texts) {
      const response = await fetchImpl(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${options.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          input: texts,
          dimensions: dimension,
          encoding_format: "float",
        }),
      })

      if (!response.ok) {
        throw new Error(`openai embedding request failed with status ${response.status}`)
      }

      const payload = (await response.json()) as OpenAiEmbeddingsResponse
      const embeddings = payload.data?.map((entry) => entry.embedding) ?? []
      return validateEmbeddings(embeddings, dimension, texts)
    },
  }
}

export interface EmbeddingProviderConfig {
  provider: EmbeddingProviderMode
  embedderUrl?: string
  embeddingModel: string
  dimension?: number
  openAiApiKey?: string
  openAiBaseUrl?: string
  openAiEmbeddingModel?: string
}

export interface AppAiEmbeddingConfig {
  embeddingProvider: EmbeddingProviderMode
  embedderUrl?: string
  embeddingModel: string
  embeddingDimension: number
  openAiApiKey?: string
  openAiBaseUrl?: string
  openAiEmbeddingModel?: string
}

export function createEmbeddingProviderFromAppAiConfig(config: AppAiEmbeddingConfig): EmbeddingProvider {
  return createEmbeddingProviderFromConfig({
    provider: config.embeddingProvider,
    embedderUrl: config.embedderUrl,
    embeddingModel: config.embeddingModel,
    dimension: config.embeddingDimension,
    openAiApiKey: config.openAiApiKey,
    openAiBaseUrl: config.openAiBaseUrl,
    openAiEmbeddingModel: config.openAiEmbeddingModel,
  })
}

function createMisconfiguredEmbeddingProvider(
  mode: EmbeddingProviderMode,
  detail: string,
  model = "misconfigured",
): EmbeddingProvider {
  return {
    model,
    dimension: EMBEDDING_DIMENSION,
    mode,
    async embedTexts() {
      throw new Error(detail)
    },
  }
}

export function createEmbeddingProviderFromConfig(config: EmbeddingProviderConfig): EmbeddingProvider {
  const dimension = config.dimension ?? EMBEDDING_DIMENSION

  if (config.provider === "openai") {
    const apiKey = config.openAiApiKey?.trim()
    if (!apiKey) {
      return createMisconfiguredEmbeddingProvider(
        "openai",
        "OpenAI embedding provider requires OPENAI_API_KEY or LLM_API_KEY",
        config.openAiEmbeddingModel ?? OPENAI_EMBEDDING_MODEL,
      )
    }

    return createOpenAiEmbeddingProvider({
      apiKey,
      baseUrl: config.openAiBaseUrl,
      model: config.openAiEmbeddingModel ?? OPENAI_EMBEDDING_MODEL,
      dimension,
    })
  }

  if (config.provider === "local") {
    const embedderUrl = config.embedderUrl?.trim()
    if (!embedderUrl) {
      return createMisconfiguredEmbeddingProvider(
        "local",
        "Local embedding provider requires EMBEDDER_URL",
        config.embeddingModel,
      )
    }

    return createHttpEmbeddingProvider({
      baseUrl: embedderUrl,
      model: config.embeddingModel,
      dimension,
    })
  }

  return createStubEmbeddingProvider()
}

export async function probeOpenAiEmbeddings(options: {
  apiKey: string
  baseUrl?: string
  model?: string
  dimension?: number
  fetchImpl?: typeof fetch
}) {
  const provider = createOpenAiEmbeddingProvider({
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
    model: options.model,
    dimension: options.dimension,
    fetchImpl: options.fetchImpl,
  })

  await provider.embedTexts(["readiness probe"])
  return true
}