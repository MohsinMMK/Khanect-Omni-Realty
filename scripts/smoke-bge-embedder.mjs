#!/usr/bin/env node

const embedderBase = process.env.EMBEDDER_URL ?? "http://localhost:8080"

async function expectOk(label, response) {
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`${label} failed: ${response.status} ${body}`)
  }
  return response.json()
}

async function main() {
  const health = await expectOk("embedder health", await fetch(`${embedderBase}/health`))
  if (health.status !== "ok") throw new Error("embedder health status not ok")
  if (health.mode !== "bge-m3") {
    throw new Error(`expected EMBEDDER_MODE=bge-m3, got mode=${health.mode}`)
  }

  const embeddings = await expectOk(
    "embeddings",
    await fetch(`${embedderBase}/v1/embeddings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "BAAI/bge-m3",
        input: ["Viewings are available from 10 AM to 6 PM with a confirmed appointment."],
      }),
    }),
  )

  const vector = embeddings.data?.[0]?.embedding
  if (!Array.isArray(vector) || vector.length !== 1024) {
    throw new Error(`expected one 1024-dimension embedding, got ${vector?.length ?? 0}`)
  }
  if (vector.some((value) => !Number.isFinite(value))) {
    throw new Error("embedding vector contains non-finite values")
  }

  console.log("bge-m3 embedder smoke ok", {
    mode: health.mode,
    model: embeddings.model,
    dimension: vector.length,
  })
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})