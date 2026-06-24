import { readFile } from "node:fs/promises"
import { test } from "node:test"
import assert from "node:assert/strict"

const source = await readFile(new URL("../src/features/admin/projects-view.tsx", import.meta.url), "utf8")

test("capability picker moves capability details into hover cards", () => {
  assert.match(source, /from\s+["']@workspace\/ui\/components\/hover-card["']/)
  assert.match(source, /<HoverCard[\s>]/)
  assert.match(source, /<HoverCardTrigger/)
  assert.match(source, /<HoverCardContent/)
  assert.match(source, /CircleHelp/)
  assert.match(source, /openCapabilityDetails/)
  assert.match(source, /onMouseEnter=\{\(\) => setOpenCapabilityDetails\(option\.value\)\}/)
  assert.match(source, /onFocus=\{\(\) => setOpenCapabilityDetails\(option\.value\)\}/)
  assert.match(source, /rounded-full/)
  assert.doesNotMatch(source, /\{option\.description\}\s*<\/span>/)
  assert.doesNotMatch(source, /Enables:\s*\{option\.tools\.join/)
  assert.doesNotMatch(source, />\s*Details\s*</)
})
