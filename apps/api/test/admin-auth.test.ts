import { describe, expect, it, vi } from "vitest"

import { isAdminApiKeyAuthorized, resolveAdminAuth } from "../src/admin-auth.js"

describe("admin auth helpers", () => {
  it("accepts the admin api key header", () => {
    expect(isAdminApiKeyAuthorized({ "x-khanect-admin-api-key": "secret-key" }, "secret-key")).toBe(true)
  })

  it("accepts bearer admin api keys", () => {
    expect(isAdminApiKeyAuthorized({ authorization: "Bearer secret-key" }, "secret-key")).toBe(true)
  })

  it("allows the dev admin stub", async () => {
    const result = await resolveAdminAuth({}, {
      allowDevAdminStub: true,
      betterAuthEnabled: false,
    })
    expect(result).toEqual({ authorized: true, mode: "dev-stub" })
  })

  it("accepts better auth sessions when enabled", async () => {
    const auth = {
      api: {
        getSession: vi.fn(async () => ({ user: { id: "u1" }, session: { id: "s1" } })),
      },
    }
    const result = await resolveAdminAuth({}, {
      allowDevAdminStub: false,
      betterAuthEnabled: true,
      auth: auth as never,
    })
    expect(result).toEqual({ authorized: true, mode: "session" })
  })
})