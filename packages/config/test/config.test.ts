import { describe, expect, it } from "vitest"

import { loadConfig } from "../src/index.js"

describe("loadConfig", () => {
  it("parses strict boolean strings", () => {
    const config = loadConfig({
      WHATSAPP_ENABLED: "true",
      INSTAGRAM_MESSAGING_ENABLED: "1",
      GMAIL_SEND_ENABLED: "false",
      GOOGLE_CALENDAR_ENABLED: "0",
    })

    expect(config.meta.whatsapp.enabled).toBe(true)
    expect(config.meta.instagram.messagingEnabled).toBe(true)
    expect(config.google.gmailSendEnabled).toBe(false)
    expect(config.google.calendarEnabled).toBe(false)
  })

  it("rejects invalid boolean strings", () => {
    expect(() => loadConfig({ WHATSAPP_ENABLED: "maybe" })).toThrow()
  })

  it("rejects invalid connection URLs", () => {
    expect(() => loadConfig({ REDIS_URL: "not a url" })).toThrow()
    expect(() => loadConfig({ DATABASE_URL: "not a url" })).toThrow()
  })

  it("parses embedder configuration", () => {
    const withUrl = loadConfig({
      EMBEDDER_URL: "http://embedder:8080",
      EMBEDDING_MODEL: "BAAI/bge-base-en-v1.5",
      EMBEDDING_ENABLED: "false",
    })

    expect(withUrl.ai).toMatchObject({
      embeddingProvider: "local",
      embedderUrl: "http://embedder:8080",
      embeddingModel: "BAAI/bge-base-en-v1.5",
      embeddingDimension: 768,
      embeddingEnabled: true,
    })

    const withoutUrl = loadConfig({ EMBEDDING_ENABLED: "true" })
    expect(withoutUrl.ai.embeddingEnabled).toBe(true)
    expect(withoutUrl.ai.embeddingProvider).toBe("stub")
    expect(withoutUrl.ai.embedderUrl).toBeUndefined()
  })

  it("parses openai embedding provider configuration", () => {
    const config = loadConfig({
      EMBEDDING_PROVIDER: "openai",
      OPENAI_API_KEY: "sk-test-key",
      EMBEDDING_DIMENSION: "1024",
    })

    expect(config.ai).toMatchObject({
      embeddingProvider: "openai",
      openAiApiKey: "sk-test-key",
      openAiEmbeddingModel: "text-embedding-3-small",
      embeddingDimension: 1024,
      embeddingEnabled: true,
    })
  })

  it("requires an openai api key for openai embeddings in production", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        BETTER_AUTH_SECRET: "production_better_auth_secret_that_is_long_enough",
        ENCRYPTION_KEY: "production_encryption_key_that_is_long_enough",
        ADMIN_API_KEY: "production_admin_api_key_that_is_long_enough",
        EMBEDDING_PROVIDER: "openai",
      }),
    ).toThrow(/OPENAI_API_KEY/)
  })

  it("parses Agno runtime configuration", () => {
    const config = loadConfig({
      AGNO_ENABLED: "true",
      AGNO_AGENT_URL: "http://agno-agent:8000",
      AGNO_SERVICE_TOKEN: "dev-agno-service-token",
      AGNO_MODEL: "gpt-5-mini",
      AGNO_EMBEDDING_MODEL: "text-embedding-3-small",
    })

    expect(config.agno).toEqual({
      enabled: true,
      agentUrl: "http://agno-agent:8000",
      serviceToken: "dev-agno-service-token",
      model: "gpt-5-mini",
      embeddingModel: "text-embedding-3-small",
    })
  })

  it("supports an explicit in-memory platform store for local end-to-end demos", () => {
    const config = loadConfig({ PLATFORM_STORE: "memory" })

    expect(config.platform.store).toBe("memory")
  })

  it("rejects the in-memory platform store in production", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        BETTER_AUTH_SECRET: "production_better_auth_secret_that_is_long_enough",
        ENCRYPTION_KEY: "production_encryption_key_that_is_long_enough",
        PLATFORM_STORE: "memory",
      }),
    ).toThrow(/PLATFORM_STORE/)
  })

  it("requires a production Agno service token when Agno is enabled", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        BETTER_AUTH_SECRET: "production_better_auth_secret_that_is_long_enough",
        ENCRYPTION_KEY: "production_encryption_key_that_is_long_enough",
        ADMIN_API_KEY: "production_admin_api_key_that_is_long_enough",
        AGNO_ENABLED: "true",
        AGNO_SERVICE_TOKEN: "phase0_dev_only_agno_service_token",
      }),
    ).toThrow(/AGNO_SERVICE_TOKEN/)
  })

  it("requires a production admin api key", () => {
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        BETTER_AUTH_SECRET: "production_better_auth_secret_that_is_long_enough",
        ENCRYPTION_KEY: "production_encryption_key_that_is_long_enough",
      }),
    ).toThrow(/ADMIN_API_KEY/)
  })

  it("parses a production admin api key", () => {
    const config = loadConfig({
      NODE_ENV: "production",
      BETTER_AUTH_SECRET: "production_better_auth_secret_that_is_long_enough",
      ENCRYPTION_KEY: "production_encryption_key_that_is_long_enough",
      ADMIN_API_KEY: "production_admin_api_key_that_is_long_enough",
    })

    expect(config.auth.adminApiKey).toBe("production_admin_api_key_that_is_long_enough")
  })

  it("rejects phase0 placeholder secrets in production", () => {
    expect(() => loadConfig({ NODE_ENV: "production" })).toThrow(/BETTER_AUTH_SECRET/)
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        BETTER_AUTH_SECRET: "phase0_dev_only_better_auth_secret_min_32_chars",
        ENCRYPTION_KEY: "phase0_dev_only_encryption_key_min_32_chars",
        ADMIN_API_KEY: "production_admin_api_key_that_is_long_enough",
      }),
    ).toThrow(/BETTER_AUTH_SECRET/)
  })
})
