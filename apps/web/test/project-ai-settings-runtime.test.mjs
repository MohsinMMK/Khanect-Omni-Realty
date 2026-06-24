import { readFileSync } from "node:fs"
import { test } from "node:test"
import assert from "node:assert/strict"

const source = readFileSync(
  new URL("../src/features/admin/project-ai-settings-drawer.tsx", import.meta.url),
  "utf8",
)

test("project AI settings edits project LLM keys and shows enforced local BGE runtime", () => {
  assert.match(source, /Project LLM key/)
  assert.match(source, /Local BGE embedder/)
  assert.match(source, /Enforced embedding runtime/)
  assert.doesNotMatch(source, /Platform default/)
})

test("project AI model presets use Go and Zen tabs with one dropdown", () => {
  assert.match(source, /CommandInput/)
  assert.match(source, /CommandList/)
  assert.match(source, /CommandItem/)
  assert.match(source, /modelPickerOpen/)
  assert.match(source, /role="combobox"/)
  assert.match(source, /modelPlan/)
  assert.match(source, /TooltipContent>Refresh models/)
  assert.match(source, /aria-label="Refresh models"/)
  assert.match(source, /size="icon-sm"/)
  assert.match(source, /value="opencode-go"/)
  assert.match(source, /value="opencode-zen"/)
  assert.doesNotMatch(source, />\s*Refresh models\s*<\/Button>/)
  assert.doesNotMatch(source, /<select/)
  assert.doesNotMatch(source, /SelectTrigger/)
  assert.doesNotMatch(source, /PopoverTrigger/)
  assert.doesNotMatch(source, /DropdownMenuRadioGroup/)
  assert.doesNotMatch(source, /function LlmPresetSection/)
})

test("project AI key field hides saved keys and uses an input copy action", () => {
  assert.match(source, /InputGroup/)
  assert.match(source, /InputGroupButton/)
  assert.match(source, /Copy/)
  assert.match(source, /Copy entered API key/)
  assert.match(source, /Your API key is encrypted and stored securely\./)
  assert.doesNotMatch(source, /config\.llm\.apiKeyMasked/)
  assert.doesNotMatch(source, /Encrypted before storage\. Go and Zen keys are different subscriptions\./)
})
