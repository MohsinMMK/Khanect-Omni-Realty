import { Badge } from "@workspace/ui/components/badge"
import { Bot, KeyRound, Sparkles } from "lucide-react"

import type { ProjectAiKeySummary } from "./types"

export function ProjectAiKeyBadges({ aiKeys }: { aiKeys: ProjectAiKeySummary }) {
  const ownLlm = aiKeys.llmSource === "project"
  const ownEmbedding = aiKeys.embeddingSource === "project"

  if (!ownLlm && !ownEmbedding) {
    return (
      <Badge variant="outline">
        <KeyRound data-icon="inline-start" />
        Platform keys
      </Badge>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Badge variant={ownLlm ? "secondary" : "outline"}>
        <Bot data-icon="inline-start" />
        LLM {ownLlm ? "project" : "platform"}
      </Badge>
      <Badge variant={ownEmbedding ? "secondary" : "outline"}>
        <Sparkles data-icon="inline-start" />
        Embed {ownEmbedding ? "project" : "platform"}
      </Badge>
    </div>
  )
}