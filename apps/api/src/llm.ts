import type { AppConfig } from "@workspace/config"
import { joinBaseUrlPath } from "@workspace/core"
import type { PlatformAnswerProvider } from "@workspace/db"

export function createConfiguredAnswerProvider(config: AppConfig): PlatformAnswerProvider | undefined {
  if (!config.ai.llmApiKey) return undefined

  return async ({ message, sources }) => {
    const response = await fetch(joinBaseUrlPath(config.ai.llmBaseUrl, "chat/completions"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.ai.llmApiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: config.ai.llmModel,
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

    const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
    const answer = body.choices?.[0]?.message?.content?.trim()
    if (!answer) throw new Error("LLM provider returned no answer")
    return { answer, model: config.ai.llmModel }
  }
}
