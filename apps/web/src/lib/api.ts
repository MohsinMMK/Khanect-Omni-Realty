export const apiBase = import.meta.env.VITE_API_BASE_URL ?? "/api/v1"
export const adminApiKeyStorageKey = "khanect-admin-api-key"

export class ApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(message: string, code: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.code = code
    this.status = status
  }
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {}
  const adminApiKey = readAdminApiKey()
  if (adminApiKey) headers["x-khanect-admin-api-key"] = adminApiKey
  if (options.body) headers["content-type"] = "application/json"

  const response = await fetch(`${apiBase}${path}`, {
    method: options.method ?? "GET",
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const text = await response.text()
  const parsed = text ? tryParseJson(text) : null
  if (!response.ok) {
    const apiError = parsed && typeof parsed === "object" && "error" in parsed ? parseApiError(parsed.error, response.status) : new ApiError(`API ${response.status}`, "REQUEST_ERROR", response.status)
    if (apiError.code === "ADMIN_AUTH_REQUIRED" && typeof window !== "undefined") {
      window.localStorage.removeItem(adminApiKeyStorageKey)
      window.dispatchEvent(new CustomEvent("khanect-admin-auth-required"))
    }
    throw apiError
  }
  return parsed as T
}

export function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export function getApiErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message
  return "Request failed"
}

export function parseApiError(error: unknown, status: number) {
  const message = getApiErrorMessage(error)
  const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "REQUEST_ERROR"
  return new ApiError(message, code, status)
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Check API and try again."
}

export function isAdminAuthError(error: unknown) {
  return error instanceof ApiError && error.code === "ADMIN_AUTH_REQUIRED"
}

export function readAdminApiKey() {
  if (typeof window === "undefined") return ""
  return window.localStorage.getItem(adminApiKeyStorageKey) ?? ""
}