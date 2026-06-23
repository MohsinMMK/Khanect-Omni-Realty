#!/usr/bin/env node

const apiBase = process.env.API_BASE_URL ?? "http://localhost:3000/api/v1"
const embedderBase = process.env.EMBEDDER_URL ?? "http://localhost:8080"

async function expectOk(label, response) {
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`${label} failed: ${response.status} ${body}`)
  }
  return response.json()
}

async function main() {
  const health = await expectOk("api health", await fetch(`${apiBase}/health`))
  if (health.status !== "ok") throw new Error("api health status not ok")

  const embedderHealth = await expectOk("embedder health", await fetch(`${embedderBase}/health`))
  if (embedderHealth.status !== "ok") throw new Error("embedder health status not ok")

  const projectResponse = await expectOk(
    "create project",
    await fetch(`${apiBase}/admin/projects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "RAG Smoke Project", domain: `rag-smoke-${Date.now()}.example` }),
    }),
  )
  const project = projectResponse.project

  const chatbotResponse = await expectOk(
    "create chatbot",
    await fetch(`${apiBase}/admin/projects/${project.id}/chatbots`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "RAG Smoke Bot", capabilities: { faq: true, leadCapture: true } }),
    }),
  )
  const chatbot = chatbotResponse.chatbot

  const contentResponse = await expectOk(
    "create content",
    await fetch(`${apiBase}/admin/chatbots/${chatbot.id}/content`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contentType: "faq",
        title: "Viewing hours",
        body: "Viewings are available from 10 AM to 6 PM every day with a confirmed appointment.",
      }),
    }),
  )
  const content = contentResponse.item

  const publishResponse = await expectOk(
    "publish content",
    await fetch(`${apiBase}/admin/chatbots/${chatbot.id}/content/${content.id}/publish`, { method: "POST" }),
  )

  const deadline = Date.now() + 30_000
  let answerResponse = null
  while (Date.now() < deadline) {
    answerResponse = await expectOk(
      "test message",
      await fetch(`${apiBase}/admin/chatbots/${chatbot.id}/test-message`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "When can I view the property?" }),
      }),
    )
    if (!answerResponse.fallback && (answerResponse.sources?.length ?? 0) > 0) break
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  if (!answerResponse || answerResponse.fallback) {
    throw new Error("test-message still fallback after waiting for rag.index worker")
  }

  console.log("rag pipeline smoke ok", {
    projectId: project.id,
    chatbotId: chatbot.id,
    chunkCount: publishResponse.chunkCount,
    sourceCount: answerResponse.sources?.length ?? 0,
    embedderMode: embedderHealth.mode,
  })
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})