import { describe, expect, it } from "vitest"

import { runProjectLlmSmokeTest } from "../src/project-ai-admin.js"

describe("project-ai-admin", () => {
  it("grounds the LLM smoke test answer in the approved source excerpt", async () => {
    let requestedBody: { messages?: Array<{ role: string; content: string }> } | undefined

    const result = await runProjectLlmSmokeTest(
      {
        projectId: "0194f0a0-0000-7000-8000-000000000001",
        llmSource: "project",
        llmApiKey: "sk-project-llm",
        llmBaseUrl: "https://api.openai.com/v1",
        llmModel: "test-model",
        embeddingSource: "platform",
      },
      {
        ai: {
          llmApiKey: "",
          llmBaseUrl: "https://api.openai.com/v1",
          llmModel: "platform-model",
        },
      } as never,
      undefined,
      async (_input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        requestedBody = JSON.parse(String(init?.body))
        return new Response(JSON.stringify({ choices: [{ message: { content: "OK" } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      },
    )

    const userMessage = requestedBody?.messages?.find((message) => message.role === "user")?.content
    expect(userMessage).toContain("Reply with the word OK only.")
    expect(userMessage).toContain("The approved smoke-test answer is OK.")
    expect(result.answerPreview).toBe("OK")
  })
})
