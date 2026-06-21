import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import pg from "pg"

const { Client } = pg
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const migrationsDir = path.join(packageRoot, "migrations")
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://realestate:change_me@localhost:5432/realestate_app"

const client = new Client({ connectionString: databaseUrl, application_name: "khanect-omni-realty-migrator" })
await client.connect()

try {
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort()
  for (const file of files) {
    if (await isRecorded(file)) {
      console.log(`skip ${file}`)
      continue
    }

    if (await knownMigrationAlreadyApplied(file)) {
      await record(file)
      console.log(`record existing ${file}`)
      continue
    }

    const sql = await readFile(path.join(migrationsDir, file), "utf8")
    await client.query("begin")
    try {
      await client.query(sql)
      await record(file)
      await client.query("commit")
      console.log(`applied ${file}`)
    } catch (error) {
      await client.query("rollback")
      throw error
    }
  }
} finally {
  await client.end()
}

async function isRecorded(file) {
  const exists = await relationExists("schema_metadata")
  if (!exists) return false
  const result = await client.query("select 1 from schema_metadata where key = $1", [`migration:${file}`])
  return result.rowCount > 0
}

async function record(file) {
  if (!(await relationExists("schema_metadata"))) {
    await client.query('create table if not exists "schema_metadata" ("key" text primary key, "value" text not null, "updated_at" timestamp with time zone default now() not null)')
  }
  await client.query(
    "insert into schema_metadata (key, value, updated_at) values ($1, $2, now()) on conflict (key) do update set value = excluded.value, updated_at = now()",
    [`migration:${file}`, "applied"],
  )
}

async function knownMigrationAlreadyApplied(file) {
  if (file.startsWith("0000_")) return relationExists("schema_metadata")
  if (file.startsWith("0001_")) {
    return (await relationExists("tenant")) && (await relationExists("rag_chunk")) && (await extensionExists("vector"))
  }
  return false
}

async function relationExists(name) {
  const result = await client.query("select to_regclass($1) as relation", [name])
  return Boolean(result.rows[0]?.relation)
}

async function extensionExists(name) {
  const result = await client.query("select 1 from pg_extension where extname = $1", [name])
  return result.rowCount > 0
}
