import { describe, expect, it, vi } from "vitest"

import {
  BGE_M3_EMBEDDING_MODEL,
  EMBEDDING_DIMENSION,
  OPENAI_EMBEDDING_MODEL,
  createEmbeddingProviderFromAppAiConfig,
  createHttpEmbeddingProvider,
  createOpenAiEmbeddingProvider,
  createStubEmbeddingProvider,
  embedTextStubHashV1,
} from "../src/embedding.js"

describe("embedding providers", () => {
  it("creates deterministic 1024-dimension stub vectors", () => {
    const first = embedTextStubHashV1("Dubai Marina approved FAQ")
    const second = embedTextStubHashV1("Dubai Marina approved FAQ")
    const different = embedTextStubHashV1("JLT parking policy")

    expect(first).toHaveLength(EMBEDDING_DIMENSION)
    expect(second).toEqual(first)
    expect(different).not.toEqual(first)
  })

  it("embeds texts through the stub provider", async () => {
    const provider = createStubEmbeddingProvider()
    const [embedding] = await provider.embedTexts(["Marina Heights pet policy"])

    expect(provider.model).toBe("stub/hash-v1")
    expect(provider.mode).toBe("stub")
    expect(embedding).toHaveLength(EMBEDDING_DIMENSION)
  })

  it("parses OpenAI-compatible embedding responses from HTTP provider", async () => {
    const vector = Array.from({ length: EMBEDDING_DIMENSION }, (_, index) => index / EMBEDDING_DIMENSION)
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ embedding: vector }] }),
    })) as unknown as typeof fetch

    const provider = createHttpEmbeddingProvider({
      baseUrl: "http://embedder:8080",
      model: BGE_M3_EMBEDDING_MODEL,
      fetchImpl,
    })
    const [embedding] = await provider.embedTexts(["test"])

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://embedder:8080/v1/embeddings",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ model: BGE_M3_EMBEDDING_MODEL, input: ["test"] }),
      }),
    )
    expect(embedding).toEqual(vector)
  })

  it("requests 1024 dimensions from OpenAI embeddings", async () => {
    const vector = Array.from({ length: EMBEDDING_DIMENSION }, () => 0.01)
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ embedding: vector }] }),
    })) as unknown as typeof fetch

    const provider = createOpenAiEmbeddingProvider({
      apiKey: "sk-test",
      fetchImpl,
    })
    const [embedding] = await provider.embedTexts(["Marina Heights pet policy"])

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.openai.com/v1/embeddings",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer sk-test" }),
        body: JSON.stringify({
          model: OPENAI_EMBEDDING_MODEL,
          input: ["Marina Heights pet policy"],
          dimensions: EMBEDDING_DIMENSION,
          encoding_format: "float",
        }),
      }),
    )
    expect(embedding).toHaveLength(EMBEDDING_DIMENSION)
  })

  it("creates providers from app ai config", () => {
    const openAi = createEmbeddingProviderFromAppAiConfig({
      embeddingProvider: "openai",
      embeddingModel: "BAAI/bge-m3",
      embeddingDimension: 1024,
      openAiApiKey: "sk-test",
      openAiBaseUrl: "https://api.openai.com/v1",
      openAiEmbeddingModel: OPENAI_EMBEDDING_MODEL,
    })

    expect(openAi.mode).toBe("openai")
    expect(openAi.model).toBe(OPENAI_EMBEDDING_MODEL)
  })

  it("defers misconfiguration errors until embed time", async () => {
    const provider = createEmbeddingProviderFromAppAiConfig({
      embeddingProvider: "openai",
      embeddingModel: "BAAI/bge-m3",
      embeddingDimension: 1024,
      openAiEmbeddingModel: OPENAI_EMBEDDING_MODEL,
    })

    await expect(provider.embedTexts(["test"])).rejects.toThrow(/OPENAI_API_KEY/)
  })

  it("throws when HTTP embedder returns invalid vectors", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ embedding: [1, 2, 3] }] }),
    })) as unknown as typeof fetch

    const provider = createHttpEmbeddingProvider({ baseUrl: "http://embedder:8080", fetchImpl })
    await expect(provider.embedTexts(["test"])).rejects.toThrow(/invalid/)
  })
})