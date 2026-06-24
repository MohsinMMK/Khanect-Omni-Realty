import { z } from "zod"

type EmbeddingProviderMode = "stub" | "local" | "openai"

const STUB_EMBEDDING_MODEL = "stub/hash-v1"
const BGE_M3_EMBEDDING_MODEL = "BAAI/bge-m3"
const BGE_SMALL_EN_V15_EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"
const BGE_BASE_EN_V15_EMBEDDING_MODEL = "BAAI/bge-base-en-v1.5"
const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small"
const EMBEDDING_DIMENSION = 1024
const BGE_SMALL_EN_V15_DIMENSION = 384
const BGE_BASE_EN_V15_DIMENSION = 768

const booleanFromString = z.preprocess((value) => {
  if (typeof value !== "string") return value

  const normalized = value.trim().toLowerCase()
  if (["true", "1"].includes(normalized)) return true
  if (["false", "0"].includes(normalized)) return false

  return value
}, z.boolean().default(false))

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional(),
)

const requiredUrl = (fallback: string) => z.string().url().default(fallback)
const connectionUrl = (fallback: string) => z.string().url().default(fallback)

const phase0AuthSecret = "phase0_auth_stub_secret_not_for_production"
const phase0EncryptionKey = "phase0_encryption_key_not_for_production"

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_VERSION: z.string().default("0.1.0"),
  APP_BASE_URL: requiredUrl("http://localhost:3000"),
  API_BASE_URL: requiredUrl("http://localhost:3000/api/v1"),
  API_INTERNAL_BASE_URL: requiredUrl("http://localhost:3000"),
  VITE_API_BASE_URL: z.string().default("/api/v1"),
  CRM_BASE_URL: requiredUrl("http://localhost:3001"),
  CORS_ORIGINS: z.string().default("http://localhost:5173,http://localhost:3000"),

  DATABASE_URL: connectionUrl("postgresql://realestate:change_me@localhost:5432/realestate_app"),
  TWENTY_DATABASE_URL: optionalString.pipe(z.string().url().optional()),
  REDIS_URL: connectionUrl("redis://localhost:6379"),

  MAP_RENDERER: z.literal("maplibre").default("maplibre"),
  MAP_TILE_URL: optionalString,
  MAP_STYLE_URL: optionalString,
  MAP_GEOCODING_PROVIDER: optionalString,
  MAP_GEOCODING_API_KEY: optionalString,

  BETTER_AUTH_URL: requiredUrl("http://localhost:3000"),
  BETTER_AUTH_SECRET: z.string().default(phase0AuthSecret),
  BETTER_AUTH_ENABLED: booleanFromString,
  ADMIN_BOOTSTRAP_EMAIL: optionalString.pipe(z.string().email().optional()),
  ENCRYPTION_KEY: z.string().default(phase0EncryptionKey),
  ADMIN_API_KEY: optionalString,

  TWENTY_API_URL: optionalString,
  TWENTY_API_KEY: optionalString,

  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  GOOGLE_REDIRECT_URI: optionalString,
  GMAIL_SEND_ENABLED: booleanFromString,
  GOOGLE_CALENDAR_ENABLED: booleanFromString,

  META_APP_ID: optionalString,
  META_APP_SECRET: optionalString,
  META_REDIRECT_URI: optionalString,
  META_WEBHOOK_VERIFY_TOKEN: optionalString,
  WHATSAPP_ENABLED: booleanFromString,
  WHATSAPP_BUSINESS_ACCOUNT_ID: optionalString,
  WHATSAPP_PHONE_NUMBER_ID: optionalString,
  WHATSAPP_ACCESS_TOKEN: optionalString,
  INSTAGRAM_MESSAGING_ENABLED: booleanFromString,
  INSTAGRAM_BUSINESS_ACCOUNT_ID: optionalString,
  INSTAGRAM_PAGE_ID: optionalString,
  INSTAGRAM_ACCESS_TOKEN: optionalString,
  INSTAGRAM_PUBLISHING_ENABLED: booleanFromString,

  EMBEDDER_VERSION: z.string().default("0.1.0"),
  EMBEDDING_PROVIDER: z.enum(["stub", "local", "openai"]).optional(),
  EMBEDDER_URL: optionalString.pipe(z.string().url().optional()),
  EMBEDDING_MODEL: z.string().default(BGE_BASE_EN_V15_EMBEDDING_MODEL),
  EMBEDDING_DIMENSION: z.coerce.number().int().positive().optional(),
  EMBEDDING_ENABLED: booleanFromString,
  OPENAI_API_KEY: optionalString,
  OPENAI_BASE_URL: optionalString.pipe(z.string().url().optional()),
  LLM_PROVIDER: z.string().default("ollama"),
  LLM_BASE_URL: requiredUrl("http://localhost:11434"),
  LLM_API_KEY: optionalString,
  LLM_MODEL: z.string().default("qwen3"),
  LOCAL_AI_ENABLED: booleanFromString,
  AGNO_ENABLED: booleanFromString,
  AGNO_AGENT_URL: requiredUrl("http://localhost:8000"),
  AGNO_SERVICE_TOKEN: z.string().default("phase0_dev_only_agno_service_token"),
  AGNO_MODEL: z.string().default("gpt-5-mini"),
  AGNO_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  PLATFORM_STORE: z.enum(["postgres", "memory"]).default("postgres"),
  WIDGET_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
  WIDGET_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  WORKER_HEALTH_PORT: z.coerce.number().int().positive().default(3001),
  RAG_INDEX_SYNC: z.preprocess((value) => {
    if (value === undefined || value === "") return undefined
    const normalized = String(value).trim().toLowerCase()
    if (["true", "1"].includes(normalized)) return true
    if (["false", "0"].includes(normalized)) return false
    return value
  }, z.boolean().optional()),

  UPLOAD_DIR: z.string().default("/app/uploads"),
  UPLOAD_TMP_DIR: z.string().default("/app/uploads/tmp"),
  UPLOAD_QUARANTINE_DIR: z.string().default("/app/uploads/quarantine"),
  MAX_IMAGE_UPLOAD_MB: z.coerce.number().int().positive().default(15),
  MAX_PDF_UPLOAD_MB: z.coerce.number().int().positive().default(25),
  MAX_FILES_PER_DRAFT: z.coerce.number().int().positive().default(20),
  CLAMAV_HOST: z.string().default("clamav"),
  CLAMAV_PORT: z.coerce.number().int().positive().default(3310),
  CLAMAV_SCAN_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),

  BACKUP_RETENTION_DAYS: z.coerce.number().int().positive().default(14),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
})

export type RawEnv = z.input<typeof envSchema>
export type AppConfig = ReturnType<typeof loadConfig>

export function loadConfig(env: NodeJS.ProcessEnv | RawEnv = process.env) {
  const parsed = envSchema.parse(env)
  enforceProductionConfig(parsed)

  return {
    nodeEnv: parsed.NODE_ENV,
    appVersion: parsed.APP_VERSION,
    logLevel: parsed.LOG_LEVEL,
    app: {
      baseUrl: parsed.APP_BASE_URL,
      apiBaseUrl: parsed.API_BASE_URL,
      apiInternalBaseUrl: parsed.API_INTERNAL_BASE_URL,
      viteApiBaseUrl: parsed.VITE_API_BASE_URL,
      crmBaseUrl: parsed.CRM_BASE_URL,
      corsOrigins: parsed.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
    },
    db: {
      databaseUrl: parsed.DATABASE_URL,
      twentyDatabaseUrl: parsed.TWENTY_DATABASE_URL,
    },
    redis: {
      url: parsed.REDIS_URL,
    },
    auth: {
      url: parsed.BETTER_AUTH_URL,
      secret: parsed.BETTER_AUTH_SECRET,
      enabled: parsed.BETTER_AUTH_ENABLED,
      bootstrapEmail: parsed.ADMIN_BOOTSTRAP_EMAIL,
      encryptionKey: parsed.ENCRYPTION_KEY,
      adminApiKey: parsed.ADMIN_API_KEY,
    },
    twenty: {
      apiUrl: parsed.TWENTY_API_URL,
      apiKey: parsed.TWENTY_API_KEY,
    },
    google: {
      clientId: parsed.GOOGLE_CLIENT_ID,
      clientSecret: parsed.GOOGLE_CLIENT_SECRET,
      redirectUri: parsed.GOOGLE_REDIRECT_URI,
      gmailSendEnabled: parsed.GMAIL_SEND_ENABLED,
      calendarEnabled: parsed.GOOGLE_CALENDAR_ENABLED,
    },
    meta: {
      appId: parsed.META_APP_ID,
      appSecret: parsed.META_APP_SECRET,
      redirectUri: parsed.META_REDIRECT_URI,
      webhookVerifyToken: parsed.META_WEBHOOK_VERIFY_TOKEN,
      whatsapp: {
        enabled: parsed.WHATSAPP_ENABLED,
        businessAccountId: parsed.WHATSAPP_BUSINESS_ACCOUNT_ID,
        phoneNumberId: parsed.WHATSAPP_PHONE_NUMBER_ID,
        accessToken: parsed.WHATSAPP_ACCESS_TOKEN,
      },
      instagram: {
        messagingEnabled: parsed.INSTAGRAM_MESSAGING_ENABLED,
        publishingEnabled: parsed.INSTAGRAM_PUBLISHING_ENABLED,
        businessAccountId: parsed.INSTAGRAM_BUSINESS_ACCOUNT_ID,
        pageId: parsed.INSTAGRAM_PAGE_ID,
        accessToken: parsed.INSTAGRAM_ACCESS_TOKEN,
      },
    },
    ai: {
      embedderVersion: parsed.EMBEDDER_VERSION,
      embeddingProvider: resolveEmbeddingProvider(parsed),
      embedderUrl: parsed.EMBEDDER_URL,
      embeddingModel: parsed.EMBEDDING_MODEL,
      embeddingDimension: resolveConfiguredEmbeddingDimension(parsed),
      openAiApiKey: resolveOpenAiApiKey(parsed),
      openAiBaseUrl: parsed.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
      openAiEmbeddingModel: resolveOpenAiEmbeddingModel(parsed),
      embeddingEnabled: resolveEmbeddingEnabled(parsed),
      llmProvider: parsed.LLM_PROVIDER,
      llmBaseUrl: parsed.LLM_BASE_URL,
      llmApiKey: parsed.LLM_API_KEY,
      llmModel: parsed.LLM_MODEL,
      localAiEnabled: parsed.LOCAL_AI_ENABLED,
    },
    agno: {
      enabled: parsed.AGNO_ENABLED,
      agentUrl: parsed.AGNO_AGENT_URL,
      serviceToken: parsed.AGNO_SERVICE_TOKEN,
      model: parsed.AGNO_MODEL,
      embeddingModel: parsed.AGNO_EMBEDDING_MODEL,
    },
    platform: {
      store: parsed.PLATFORM_STORE,
      ragIndexSync: parsed.RAG_INDEX_SYNC ?? parsed.NODE_ENV !== "production",
      widgetRateLimitMax: parsed.WIDGET_RATE_LIMIT_MAX,
      widgetRateLimitWindowMs: parsed.WIDGET_RATE_LIMIT_WINDOW_MS,
    },
    runtime: {
      shutdownTimeoutMs: parsed.SHUTDOWN_TIMEOUT_MS,
      workerHealthPort: parsed.WORKER_HEALTH_PORT,
    },
    map: {
      renderer: parsed.MAP_RENDERER,
      tileUrl: parsed.MAP_TILE_URL,
      styleUrl: parsed.MAP_STYLE_URL,
      geocodingProvider: parsed.MAP_GEOCODING_PROVIDER,
      geocodingApiKey: parsed.MAP_GEOCODING_API_KEY,
    },
    uploads: {
      uploadDir: parsed.UPLOAD_DIR,
      tempDir: parsed.UPLOAD_TMP_DIR,
      quarantineDir: parsed.UPLOAD_QUARANTINE_DIR,
      maxImageUploadMb: parsed.MAX_IMAGE_UPLOAD_MB,
      maxPdfUploadMb: parsed.MAX_PDF_UPLOAD_MB,
      maxFilesPerDraft: parsed.MAX_FILES_PER_DRAFT,
      clamav: {
        host: parsed.CLAMAV_HOST,
        port: parsed.CLAMAV_PORT,
        scanTimeoutMs: parsed.CLAMAV_SCAN_TIMEOUT_MS,
      },
    },
    backup: {
      retentionDays: parsed.BACKUP_RETENTION_DAYS,
    },
  } as const
}

function resolveEmbeddingProvider(parsed: z.output<typeof envSchema>): EmbeddingProviderMode {
  if (parsed.EMBEDDING_PROVIDER) return parsed.EMBEDDING_PROVIDER
  if (parsed.EMBEDDER_URL) return "local" as const
  return "stub" as const
}

function resolveOpenAiApiKey(parsed: z.output<typeof envSchema>) {
  if (resolveEmbeddingProvider(parsed) !== "openai") return undefined
  return parsed.OPENAI_API_KEY ?? parsed.LLM_API_KEY
}

function resolveOpenAiEmbeddingModel(parsed: z.output<typeof envSchema>) {
  if (
    parsed.EMBEDDING_MODEL === BGE_M3_EMBEDDING_MODEL ||
    parsed.EMBEDDING_MODEL === BGE_BASE_EN_V15_EMBEDDING_MODEL ||
    parsed.EMBEDDING_MODEL === STUB_EMBEDDING_MODEL
  ) {
    return OPENAI_EMBEDDING_MODEL
  }
  return parsed.EMBEDDING_MODEL
}

function resolveConfiguredEmbeddingDimension(parsed: z.output<typeof envSchema>) {
  const provider = resolveEmbeddingProvider(parsed)
  if (parsed.EMBEDDING_DIMENSION) return parsed.EMBEDDING_DIMENSION
  if (provider === "stub" || provider === "openai") return EMBEDDING_DIMENSION
  if (parsed.EMBEDDING_MODEL === BGE_SMALL_EN_V15_EMBEDDING_MODEL) return BGE_SMALL_EN_V15_DIMENSION
  return BGE_BASE_EN_V15_DIMENSION
}

function resolveEmbeddingEnabled(parsed: z.output<typeof envSchema>) {
  const provider = resolveEmbeddingProvider(parsed)
  if (provider === "stub") return parsed.EMBEDDING_ENABLED
  return true
}

function enforceProductionConfig(parsed: z.output<typeof envSchema>) {
  if (parsed.NODE_ENV !== "production") return

  const issues: string[] = []

  requireSecret(parsed.BETTER_AUTH_SECRET, "BETTER_AUTH_SECRET", phase0AuthSecret, issues)
  requireSecret(parsed.ENCRYPTION_KEY, "ENCRYPTION_KEY", phase0EncryptionKey, issues)
  requireSecret(parsed.ADMIN_API_KEY ?? "", "ADMIN_API_KEY", "", issues)

  if (parsed.WHATSAPP_ENABLED) {
    requirePresent(parsed.META_WEBHOOK_VERIFY_TOKEN, "META_WEBHOOK_VERIFY_TOKEN", issues)
    requirePresent(parsed.WHATSAPP_BUSINESS_ACCOUNT_ID, "WHATSAPP_BUSINESS_ACCOUNT_ID", issues)
    requirePresent(parsed.WHATSAPP_PHONE_NUMBER_ID, "WHATSAPP_PHONE_NUMBER_ID", issues)
    requirePresent(parsed.WHATSAPP_ACCESS_TOKEN, "WHATSAPP_ACCESS_TOKEN", issues)
  }

  if (parsed.INSTAGRAM_MESSAGING_ENABLED || parsed.INSTAGRAM_PUBLISHING_ENABLED) {
    requirePresent(parsed.META_WEBHOOK_VERIFY_TOKEN, "META_WEBHOOK_VERIFY_TOKEN", issues)
    requirePresent(parsed.INSTAGRAM_BUSINESS_ACCOUNT_ID, "INSTAGRAM_BUSINESS_ACCOUNT_ID", issues)
    requirePresent(parsed.INSTAGRAM_ACCESS_TOKEN, "INSTAGRAM_ACCESS_TOKEN", issues)
  }

  if (parsed.AGNO_ENABLED) {
    requireSecret(parsed.AGNO_SERVICE_TOKEN, "AGNO_SERVICE_TOKEN", "phase0_dev_only_agno_service_token", issues)
  }

  if (resolveEmbeddingProvider(parsed) === "openai") {
    requirePresent(resolveOpenAiApiKey(parsed), "OPENAI_API_KEY", issues)
  }

  if (resolveEmbeddingProvider(parsed) === "local") {
    requirePresent(parsed.EMBEDDER_URL, "EMBEDDER_URL", issues)
  }

  if (parsed.PLATFORM_STORE === "memory") {
    issues.push("PLATFORM_STORE=memory is not allowed in production")
  }

  if (parsed.GMAIL_SEND_ENABLED || parsed.GOOGLE_CALENDAR_ENABLED) {
    requirePresent(parsed.GOOGLE_CLIENT_ID, "GOOGLE_CLIENT_ID", issues)
    requirePresent(parsed.GOOGLE_CLIENT_SECRET, "GOOGLE_CLIENT_SECRET", issues)
    requirePresent(parsed.GOOGLE_REDIRECT_URI, "GOOGLE_REDIRECT_URI", issues)
  }

  if (issues.length > 0) {
    throw new Error(`Invalid production config: ${issues.join(", ")}`)
  }
}

function requireSecret(value: string, name: string, disallowedDefault: string, issues: string[]) {
  const normalized = value.toLowerCase()
  const looksLikePlaceholder = normalized.includes("phase0") || normalized.includes("dev_only")

  if (value.length < 32 || value === disallowedDefault || looksLikePlaceholder) {
    issues.push(`${name} must be set to a production secret with at least 32 characters`)
  }
}

function requirePresent(value: string | undefined, name: string, issues: string[]) {
  if (!value) {
    issues.push(`${name} is required`)
  }
}
