import { readFileSync } from "node:fs"
import { test } from "node:test"
import assert from "node:assert/strict"

const source = readFileSync(
  new URL("../src/features/admin/content-view.tsx", import.meta.url),
  "utf8",
)

test("chatbot detail drawer uses a fixed layout instead of resizable panels", () => {
  assert.match(source, /Chatbot setup/)
  assert.match(source, /Test chatbot/)
  assert.match(source, /xl:grid-cols-\[minmax\(0,1fr\)_minmax\(20rem,0\.72fr\)\]/)
  assert.doesNotMatch(source, /ResizablePanelGroup/)
  assert.doesNotMatch(source, /ResizablePanel/)
  assert.doesNotMatch(source, /ResizableHandle/)
  assert.doesNotMatch(source, /@workspace\/ui\/components\/resizable/)
})
