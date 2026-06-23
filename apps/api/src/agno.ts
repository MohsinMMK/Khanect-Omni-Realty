import type { AppConfig } from "@workspace/config"
import type { PlatformAnswerProvider, PlatformChatAnswerDto } from "@workspace/db"

interface AgnoRunResponse {
  answer?: string
  model?: string
  confidence?: PlatformChatAnswerDto["confidence"]
  actionTrace?: Record<string, unknown>
  agentTraceId?: string
}

export function createAgnoAnswerProvider(config: AppConfig): PlatformAnswerProvider | undefined {
  if (!config.agno.enabled) return undefined

  return async ({ message, sources, chatbot, channel }) => {
    const response = await fetch(new URL("/v1/chatbots/run", config.agno.agentUrl), {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.agno.serviceToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message,
        channel,
        chatbot: {
          id: chatbot.id,
          projectId: chatbot.projectId,
          name: chatbot.name,
          purpose: chatbot.purpose,
          capabilities: chatbot.capabilities,
          agentKey: chatbot.agentKey,
          knowledgeNamespace: chatbot.knowledgeNamespace,
        },
        sources,
      }),
    })

    if (!response.ok) {
      throw new Error(`Agno agent returned ${response.status}`)
    }

    const body = (await response.json()) as AgnoRunResponse
    if (!body.answer) throw new Error("Agno agent returned no answer")

    return {
      answer: body.answer,
      model: body.model ?? config.agno.model,
      confidence: body.confidence,
      actionTrace: { runtime: "agno", ...(body.actionTrace ?? {}) },
      agentTraceId: body.agentTraceId,
    }
  }
}
