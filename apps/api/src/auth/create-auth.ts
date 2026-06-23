import type { AppConfig } from "@workspace/config"
import { authSchema, createDbClient, createPgPoolFromConfig } from "@workspace/db"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"

export function createBetterAuthRuntime(config: AppConfig) {
  const pool = createPgPoolFromConfig(config)
  const db = createDbClient(pool)
  const auth = betterAuth({
    baseURL: config.auth.url,
    secret: config.auth.secret,
    trustedOrigins: config.app.corsOrigins,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: authSchema,
    }),
    emailAndPassword: {
      enabled: true,
    },
  })

  return {
    auth,
    close: async () => {
      await pool.end()
    },
  }
}

export type BetterAuthRuntime = ReturnType<typeof createBetterAuthRuntime>
export type AppAuth = BetterAuthRuntime["auth"]