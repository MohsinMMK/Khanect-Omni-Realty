import { loadConfig } from "@workspace/config"
import { describe, expect, it, vi } from "vitest"

// Exercise the real BetterAuth endpoint hooks with its isolated in-memory adapter.
vi.mock("@workspace/db", () => ({
  authSchema: {},
  createDbClient: () => undefined,
  createPgPoolFromConfig: () => ({ end: async () => undefined }),
}))
vi.mock("better-auth/adapters/drizzle", () => ({
  drizzleAdapter: () => undefined,
}))

import { createBetterAuthRuntime } from "../src/auth/create-auth.js"

describe("admin account provisioning", () => {
  it("rejects public registration while preserving protected server provisioning and sign-in", async () => {
    const runtime = createBetterAuthRuntime(
      loadConfig({
        NODE_ENV: "test",
        BETTER_AUTH_URL: "http://localhost:3000",
      })
    )
    const body = {
      name: "Admin",
      email: "admin@example.com",
      password: "test-password-more-than-12",
    }
    try {
      for (const path of [
        "/sign-up/email",
        "/sign-up/email?next=/admin/bootstrap",
        "/x/../sign-up/email",
      ]) {
        const response = await runtime.auth.handler(
          new Request(`http://localhost:3000/api/auth${path}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          })
        )
        expect(response.status).toBe(403)
      }
      const provisioned = await runtime.auth.api.signUpEmail({ body })
      expect(provisioned.user.email).toBe(body.email)
      const signedIn = await runtime.auth.handler(
        new Request("http://localhost:3000/api/auth/sign-in/email", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: body.email, password: body.password }),
        })
      )
      expect(signedIn.status).toBe(200)
    } finally {
      await runtime.close()
    }
  })
})
