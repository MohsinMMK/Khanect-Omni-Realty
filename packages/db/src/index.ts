import { loadConfig, type AppConfig } from "@workspace/config"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool, type PoolConfig } from "pg"

import * as schema from "./schema.js"

export * from "./phase1a.js"
export * from "./platform.js"
export { schema }
export type AppDb = ReturnType<typeof createDbClient>

export interface CreatePoolOptions {
  databaseUrl?: string
  pool?: PoolConfig
}

export function createPgPool(options: CreatePoolOptions = {}) {
  const config = loadConfig()
  return new Pool({
    connectionString: options.databaseUrl ?? config.db.databaseUrl,
    application_name: "khanect-omni-realty",
    max: 10,
    ...options.pool,
  })
}

export function createPgPoolFromConfig(config: AppConfig, options: Omit<CreatePoolOptions, "databaseUrl"> = {}) {
  return new Pool({
    connectionString: config.db.databaseUrl,
    application_name: "khanect-omni-realty",
    max: 10,
    ...options.pool,
  })
}

export function createDbClient(pool: Pool) {
  return drizzle(pool, { schema })
}

export async function closePgPool(pool: Pool) {
  await pool.end()
}
