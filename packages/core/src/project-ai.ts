import {
  createEmbeddingProviderFromConfig,
  getLocalEmbeddingPresetByModel,
  resolveEmbeddingDimension,
  type AppAiEmbeddingConfig,
  type EmbeddingProvider,
  type EmbeddingProviderMode,
} from "./embedding.js"
import { maskSecret } from "./secrets.js"

export type ProjectAiSource = "platform" | "project"

export interface ProjectAiPlatformConfig extends AppAiEmbeddingConfig {
  llmBaseUrl: string
  llmApiKey?: string
  llmModel: string
}

export interface ProjectAiSecrets {
  projectId: string
  llmSource: ProjectAiSource
  llmApiKey?: string
  llmBaseUrl?: string
  llmModel?: string
  embeddingSource: ProjectAiSource
  embeddingProvider?: EmbeddingProviderMode
  embeddingApiKey?: string
  embedderUrl?: string
  embeddingModel?: string
  embeddingDimension?: number
}

export interface ProjectLlmConfigDto {
  source: ProjectAiSource
  apiKeyConfigured: boolean
  apiKeyMasked: string | null
  baseUrl: string | null
  model: string | null
  effectiveBaseUrl: string
  effectiveModel: string
}

export interface ProjectLlmRuntimeConfig {
  source: ProjectAiSource
  apiKey?: string
  baseUrl: string
  model: string
  configured: boolean
}

export interface ProjectEmbeddingConfigDto {
  source: ProjectAiSource
  provider: EmbeddingProviderMode
  configuredProvider: EmbeddingProviderMode | null
  apiKeyConfigured: boolean
  apiKeyMasked: string | null
  embedderUrl: string | null
  model: string | null
  dimension: number
  requiresReindex: boolean
  status: "ok" | "misconfigured"
  detail?: string
}

export interface ProjectAiConfigDto {
  projectId: string
  llm: ProjectLlmConfigDto
  embedding: ProjectEmbeddingConfigDto
  updatedAt: string | null
}

export interface ProjectAiConfigUpdateInput {
  llm?: {
    source?: ProjectAiSource
    apiKey?: string | null
    baseUrl?: string | null
    model?: string | null
  }
  embedding?: {
    source?: ProjectAiSource
    provider?: EmbeddingProviderMode
    apiKey?: string | null
    embedderUrl?: string | null
    model?: string | null
    dimension?: number | null
  }
}

export interface ProjectAnswerProviderInput {
  message: string
  sources: Array<{ title: string; excerpt: string }>
}

export interface ProjectAnswerProviderResult {
  answer: string
  model: string
}

export type ProjectAnswerProvider = (input: ProjectAnswerProviderInput) => Promise<ProjectAnswerProviderResult>

export interface ProjectAiRuntimeResolver {
  resolveEmbeddingProvider(projectId: string): Promise<EmbeddingProvider>
  resolveAnswerProvider(projectId: string): Promise<ProjectAnswerProvider | undefined>
  resolveLlmConfig(projectId: string): Promise<ProjectLlmRuntimeConfig>
}

export function joinBaseUrlPath(baseUrl: string, path: string): URL {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`
  const normalizedPath = path.replace(/^\/+/, "")
  return new URL(normalizedPath, normalizedBase)
}

function resolveEffectiveLlm(secrets: ProjectAiSecrets | null, platform: ProjectAiPlatformConfig) {
  const useProject = secrets?.llmSource === "project"
  return {
    apiKey: useProject ? secrets?.llmApiKey?.trim() : platform.llmApiKey?.trim(),
    baseUrl: (useProject ? secrets?.llmBaseUrl : platform.llmBaseUrl)?.trim() || platform.llmBaseUrl,
    model: (useProject ? secrets?.llmModel : platform.llmModel)?.trim() || platform.llmModel,
    source: secrets?.llmSource ?? "platform",
    configured: useProject ? Boolean(secrets?.llmApiKey?.trim()) : Boolean(platform.llmApiKey?.trim()),
    masked: maskSecret(useProject ? secrets?.llmApiKey : platform.llmApiKey),
    projectBaseUrl: secrets?.llmBaseUrl ?? null,
    projectModel: secrets?.llmModel ?? null,
  }
}

export function resolveProjectLlmRuntime(
  secrets: ProjectAiSecrets | null,
  platform: ProjectAiPlatformConfig,
): ProjectLlmRuntimeConfig {
  const llm = resolveEffectiveLlm(secrets, platform)
  return {
    source: llm.source,
    apiKey: llm.apiKey,
    baseUrl: llm.baseUrl,
    model: llm.model,
    configured: llm.configured,
  }
}

function resolveEffectiveEmbedding(secrets: ProjectAiSecrets | null, platform: ProjectAiPlatformConfig) {
  const useProject = secrets?.embeddingSource === "project"
  const provider = useProject
    ? secrets?.embeddingProvider ?? platform.embeddingProvider
    : platform.embeddingProvider

  const apiKey = useProject ? secrets?.embeddingApiKey?.trim() : platform.openAiApiKey?.trim()
  const embedderUrl = useProject ? secrets?.embedderUrl?.trim() : platform.embedderUrl?.trim()
  const model = useProject
    ? secrets?.embeddingModel?.trim() || platform.embeddingModel
    : provider === "openai"
      ? platform.openAiEmbeddingModel
      : platform.embeddingModel
  const preset = provider === "local" ? getLocalEmbeddingPresetByModel(model) : undefined
  const dimension = useProject
    ? resolveEmbeddingDimension({
      provider,
      model,
      fallbackDimension: secrets?.embeddingDimension ?? platform.embeddingDimension,
    })
    : resolveEmbeddingDimension({ provider, model, fallbackDimension: platform.embeddingDimension })

  let status: "ok" | "misconfigured" = "ok"
  let detail: string | undefined

  if (provider === "openai" && !apiKey) {
    status = "misconfigured"
    detail = useProject
      ? "Add an OpenAI API key for this project's embeddings."
      : "Set OPENAI_API_KEY on the server or configure a project embedding key."
  }

  if (provider === "local" && !embedderUrl) {
    status = "misconfigured"
    detail = useProject
      ? "Add an embedder URL for this project's local embeddings."
      : "Set EMBEDDER_URL on the server or configure a project embedder URL."
  }

  if (provider === "local" && !preset) {
    status = "misconfigured"
    detail = `Choose a supported local embedding preset. "${model}" is not in the local BGE catalog.`
  }

  return {
    provider,
    configuredProvider: useProject ? secrets?.embeddingProvider ?? null : null,
    apiKey,
    embedderUrl: embedderUrl ?? null,
    model: model ?? null,
    dimension,
    requiresReindex: useProject
      ? Boolean(secrets?.embeddingDimension && secrets.embeddingDimension !== dimension)
      : false,
    source: secrets?.embeddingSource ?? "platform",
    configured: provider === "openai"
      ? Boolean(apiKey)
      : provider === "local"
        ? Boolean(embedderUrl)
        : true,
    masked: maskSecret(useProject ? secrets?.embeddingApiKey : platform.openAiApiKey),
    status,
    detail,
  }
}

export function buildProjectAiConfigDto(
  secrets: ProjectAiSecrets | null,
  platform: ProjectAiPlatformConfig,
  projectId: string,
  updatedAt: string | null = null,
): ProjectAiConfigDto {
  const llm = resolveEffectiveLlm(secrets, platform)
  const embedding = resolveEffectiveEmbedding(secrets, platform)

  return {
    projectId,
    updatedAt,
    llm: {
      source: llm.source,
      apiKeyConfigured: llm.configured,
      apiKeyMasked: llm.masked,
      baseUrl: llm.projectBaseUrl,
      model: llm.projectModel,
      effectiveBaseUrl: llm.baseUrl,
      effectiveModel: llm.model,
    },
    embedding: {
      source: embedding.source,
      provider: embedding.provider,
      configuredProvider: embedding.configuredProvider,
      apiKeyConfigured: embedding.configured,
      apiKeyMasked: embedding.masked,
      embedderUrl: embedding.embedderUrl,
      model: embedding.model,
      dimension: embedding.dimension,
      requiresReindex: embedding.requiresReindex,
      status: embedding.status,
      detail: embedding.detail,
    },
  }
}

export function resolveProjectEmbeddingProvider(
  secrets: ProjectAiSecrets | null,
  platform: ProjectAiPlatformConfig,
): EmbeddingProvider {
  const embedding = resolveEffectiveEmbedding(secrets, platform)

  if (secrets?.embeddingSource !== "project") {
    return createEmbeddingProviderFromConfig({
      provider: platform.embeddingProvider,
      embedderUrl: platform.embedderUrl,
      embeddingModel: platform.embeddingModel,
      dimension: platform.embeddingDimension,
      openAiApiKey: platform.openAiApiKey,
      openAiBaseUrl: platform.openAiBaseUrl,
      openAiEmbeddingModel: platform.openAiEmbeddingModel,
    })
  }

  return createEmbeddingProviderFromConfig({
    provider: embedding.provider,
    embedderUrl: embedding.embedderUrl ?? undefined,
    embeddingModel: embedding.model ?? platform.embeddingModel,
    dimension: embedding.dimension,
    openAiApiKey: embedding.apiKey,
    openAiBaseUrl: platform.openAiBaseUrl,
    openAiEmbeddingModel: embedding.model ?? platform.openAiEmbeddingModel,
  })
}

export function createProjectAnswerProvider(
  secrets: ProjectAiSecrets | null,
  platform: ProjectAiPlatformConfig,
  fetchImpl: typeof fetch = fetch,
): ProjectAnswerProvider | undefined {
  const llm = resolveEffectiveLlm(secrets, platform)
  if (!llm.apiKey) return undefined

  return async ({ message, sources }) => {
    const response = await fetchImpl(joinBaseUrlPath(llm.baseUrl, "chat/completions"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${llm.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: llm.model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "Answer only from the approved source excerpts. If the excerpts do not contain the answer, say you do not have an approved source.",
          },
          {
            role: "user",
            content: `Question: ${message}\n\nApproved sources:\n${sources.map((source, index) => `[${index + 1}] ${source.title}: ${source.excerpt}`).join("\n")}`,
          },
        ],
      }),
    })

    if (!response.ok) {
      throw new Error(`LLM provider returned ${response.status}`)
    }

    const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const answer = body.choices?.[0]?.message?.content?.trim()
    if (!answer) throw new Error("LLM provider returned no answer")
    return { answer, model: llm.model }
  }
}

export function createProjectAiRuntimeResolver(
  platform: ProjectAiPlatformConfig,
  loadSecrets: (projectId: string) => Promise<ProjectAiSecrets | null>,
  fetchImpl: typeof fetch = fetch,
): ProjectAiRuntimeResolver {
  return {
    async resolveEmbeddingProvider(projectId) {
      const secrets = await loadSecrets(projectId)
      return resolveProjectEmbeddingProvider(secrets, platform)
    },
    async resolveAnswerProvider(projectId) {
      const secrets = await loadSecrets(projectId)
      return createProjectAnswerProvider(secrets, platform, fetchImpl)
    },
    async resolveLlmConfig(projectId) {
      const secrets = await loadSecrets(projectId)
      return resolveProjectLlmRuntime(secrets, platform)
    },
  }
}
