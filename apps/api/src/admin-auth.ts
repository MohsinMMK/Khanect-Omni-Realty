import { fromNodeHeaders } from "better-auth/node"
import type { FastifyReply } from "fastify"

import type { AppAuth } from "./auth/create-auth.js"

export interface AdminAuthOptions {
  allowDevAdminStub: boolean
  adminApiKey?: string
  betterAuthEnabled: boolean
  auth?: AppAuth | null
}

export type AdminAuthMode = "dev-stub" | "api-key" | "session"

export function isAdminApiKeyAuthorized(
  headers: Record<string, string | string[] | undefined>,
  adminApiKey: string | undefined,
) {
  if (!adminApiKey) return false
  const direct = headers["x-khanect-admin-api-key"]
  if (direct === adminApiKey || (Array.isArray(direct) && direct.includes(adminApiKey))) return true
  const authorization = headers.authorization
  if (authorization === `Bearer ${adminApiKey}`) return true
  if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length) === adminApiKey
  }
  return false
}

export async function resolveAdminAuth(
  headers: Record<string, string | string[] | undefined>,
  options: AdminAuthOptions,
): Promise<{ authorized: true; mode: AdminAuthMode } | { authorized: false }> {
  if (options.allowDevAdminStub) {
    return { authorized: true, mode: "dev-stub" }
  }
  if (isAdminApiKeyAuthorized(headers, options.adminApiKey)) {
    return { authorized: true, mode: "api-key" }
  }
  if (options.betterAuthEnabled && options.auth) {
    const session = await options.auth.api.getSession({
      headers: fromNodeHeaders(headers as Record<string, string>),
    })
    if (session) {
      return { authorized: true, mode: "session" }
    }
  }
  return { authorized: false }
}

export function sendAdminAuthRequired(reply: FastifyReply, betterAuthEnabled: boolean) {
  return reply.status(401).send({
    error: {
      code: "ADMIN_AUTH_REQUIRED",
      message: betterAuthEnabled
        ? "Admin session or API key is required."
        : "Admin API key is required.",
    },
  })
}