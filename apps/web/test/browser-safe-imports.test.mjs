import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { test } from "node:test"
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"

const sourceRoot = fileURLToPath(new URL("../src/", import.meta.url))

async function listSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) return listSourceFiles(entryPath)
      return /\.(ts|tsx)$/.test(entry.name) ? [entryPath] : []
    }),
  )

  return files.flat()
}

test("browser source imports browser-safe core subpaths instead of the root barrel", async () => {
  const files = await listSourceFiles(sourceRoot)
  const offenders = []

  for (const file of files) {
    const source = await readFile(file, "utf8")
    if (/from\s+["']@workspace\/core["']/.test(source)) {
      offenders.push(path.relative(sourceRoot, file))
    }
  }

  assert.deepEqual(offenders, [])
})
