import type { AppConfig } from "@workspace/config"
import { probeOpenAiEmbeddings } from "@workspace/core"
import { createPgPool } from "@workspace/db"
import net from "node:net"

export type ReadinessDependency = "postgres" | "redis" | "embedder" | "openai-embeddings"

export interface ReadinessCheckResult {
  dependency: ReadinessDependency
  status: "ok" | "unavailable"
  detail?: string
}

export interface ReadinessProbeOptions {
  config: AppConfig
  checkPostgres?: (databaseUrl: string) => Promise<boolean>
  checkRedis?: (redisUrl: string) => Promise<boolean>
  checkEmbedder?: (embedderUrl: string) => Promise<boolean>
  checkOpenAiEmbeddings?: (config: AppConfig) => Promise<boolean>
}

export async function probeReadiness(options: ReadinessProbeOptions): Promise<ReadinessCheckResult[]> {
  const { config } = options
  const checks: ReadinessCheckResult[] = []

  if (config.platform.store === "postgres") {
    const ok = await (options.checkPostgres ?? checkPostgresQuery)(config.db.databaseUrl)
    checks.push({
      dependency: "postgres",
      status: ok ? "ok" : "unavailable",
      detail: ok ? undefined : "database query failed",
    })
  }

  const redisOk = await (options.checkRedis ?? checkRedisTcp)(config.redis.url)
  checks.push({
    dependency: "redis",
    status: redisOk ? "ok" : "unavailable",
    detail: redisOk ? undefined : "redis tcp connection failed",
  })

  if (config.ai.embeddingProvider === "local" && config.ai.embedderUrl) {
    const embedderOk = await (options.checkEmbedder ?? checkEmbedderHttp)(config.ai.embedderUrl)
    checks.push({
      dependency: "embedder",
      status: embedderOk ? "ok" : "unavailable",
      detail: embedderOk ? undefined : "embedder health check failed",
    })
  }

  if (config.ai.embeddingProvider === "openai") {
    const apiKey = config.ai.openAiApiKey?.trim()
    if (!apiKey) {
      checks.push({
        dependency: "openai-embeddings",
        status: "unavailable",
        detail: "OPENAI_API_KEY or LLM_API_KEY is required",
      })
    } else {
      const openAiOk = await (options.checkOpenAiEmbeddings ?? checkOpenAiEmbeddingsDefault)(config)
      checks.push({
        dependency: "openai-embeddings",
        status: openAiOk ? "ok" : "unavailable",
        detail: openAiOk ? undefined : "openai embedding probe failed",
      })
    }
  }

  return checks
}

export function readinessIsOk(checks: ReadinessCheckResult[]) {
  return checks.every((check) => check.status === "ok")
}

async function checkPostgresQuery(databaseUrl: string) {
  const pool = createPgPool({ databaseUrl })
  try {
    await pool.query("SELECT 1")
    return true
  } catch {
    return false
  } finally {
    await pool.end()
  }
}

async function checkRedisTcp(redisUrl: string) {
  try {
    const url = new URL(redisUrl)
    const host = url.hostname
    const port = Number(url.port || 6379)
    return await tcpConnect(host, port, 2_000)
  } catch {
    return false
  }
}

async function checkOpenAiEmbeddingsDefault(config: AppConfig) {
  const apiKey = config.ai.openAiApiKey?.trim()
  if (!apiKey) return false

  try {
    await probeOpenAiEmbeddings({
      apiKey,
      baseUrl: config.ai.openAiBaseUrl,
      model: config.ai.openAiEmbeddingModel,
      dimension: config.ai.embeddingDimension,
    })
    return true
  } catch {
    return false
  }
}

async function checkEmbedderHttp(embedderUrl: string) {
  try {
    const response = await fetch(`${embedderUrl.replace(/\/$/, "")}/health`, { signal: AbortSignal.timeout(3_000) })
    if (!response.ok) return false
    const payload = (await response.json()) as { status?: string }
    return payload.status === "ok"
  } catch {
    return false
  }
}

function tcpConnect(host: string, port: number, timeoutMs: number) {
  return new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host, port })
    const timeout = setTimeout(() => {
      socket.destroy()
      resolve(false)
    }, timeoutMs)

    socket.once("connect", () => {
      clearTimeout(timeout)
      socket.end()
      resolve(true)
    })

    socket.once("error", () => {
      clearTimeout(timeout)
      resolve(false)
    })
  })
}