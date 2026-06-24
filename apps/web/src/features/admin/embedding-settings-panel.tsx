import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Separator } from "@workspace/ui/components/separator"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Spinner } from "@workspace/ui/components/spinner"
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"
import {
  Cloud,
  Cpu,
  FlaskConical,
  PlugZap,
  RefreshCw,
  Server,
  Sparkles,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import { api, getErrorMessage } from "@/lib/api"
import type { EmbeddingAdminStatus, EmbeddingSmokeTestResult } from "./types"

const providerIcons = {
  stub: FlaskConical,
  openai: Cloud,
  local: Server,
} as const

function statusBadgeVariant(status: EmbeddingAdminStatus["status"]) {
  if (status === "ok") return "secondary" as const
  if (status === "misconfigured") return "outline" as const
  return "destructive" as const
}

export function EmbeddingSettingsPanel() {
  const [status, setStatus] = useState<EmbeddingAdminStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<EmbeddingSmokeTestResult | null>(null)
  const [testError, setTestError] = useState("")
  const [sample, setSample] = useState("Marina Heights pet policy")

  const loadStatus = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await api<EmbeddingAdminStatus>("/admin/ai/embedding")
      setStatus(response)
    } catch (apiError) {
      setStatus(null)
      setError(getErrorMessage(apiError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  async function runSmokeTest() {
    setTesting(true)
    setTestError("")
    setTestResult(null)
    try {
      const response = await api<EmbeddingSmokeTestResult>("/admin/ai/embedding/test", {
        method: "POST",
        body: { sample },
      })
      setTestResult(response)
    } catch (apiError) {
      setTestError(getErrorMessage(apiError))
    } finally {
      setTesting(false)
    }
  }

  const activeMode = status?.modes.find((mode) => mode.id === status.provider)
  const ActiveIcon = status ? providerIcons[status.provider] : PlugZap

  return (
    <Card className="xl:col-span-2">
      <CardHeader>
        <CardTitle>Platform embedding fallback</CardTitle>
        <CardDescription>
          Read-only server fallback used only when a project has not saved its own embedding key. Configure production credentials per project under Projects → AI keys.
        </CardDescription>
        <CardAction>
          {status && <Badge variant={statusBadgeVariant(status.status)}>{status.status}</Badge>}
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Could not load embedding status</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-2/3 rounded-xl" />
          </div>
        )}

        {!loading && status && (
          <>
            <Alert>
              <AlertTitle>Configure embeddings in Projects → AI keys</AlertTitle>
              <AlertDescription>
                Save a separate OpenAI-compatible embeddings key per project. OpenCode Zen covers chat answers only; embeddings use a hosted `/v1/embeddings` API at 1024 dimensions.
              </AlertDescription>
            </Alert>

            <div className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  <ActiveIcon data-icon="inline-start" />
                  {activeMode?.label ?? status.provider}
                </Badge>
                <Badge variant="outline">{status.model}</Badge>
                <Badge variant="outline">{status.dimension} dimensions</Badge>
                {status.enabled ? (
                  <Badge variant="secondary">Enabled</Badge>
                ) : (
                  <Badge variant="outline">Disabled</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {activeMode?.summary ?? "Embedding provider details are unavailable."}
              </p>
              {status.detail && (
                <Alert variant={status.status === "ok" ? "default" : "destructive"}>
                  <AlertTitle>{status.status === "ok" ? "Runtime note" : "Action required"}</AlertTitle>
                  <AlertDescription>{status.detail}</AlertDescription>
                </Alert>
              )}
            </div>

            <FieldGroup>
              <Field>
                <FieldLabel>Active provider</FieldLabel>
                <ToggleGroup className="w-full flex-wrap" spacing={0} value={[status.provider]} variant="outline">
                  {status.modes.map((mode) => {
                    const Icon = providerIcons[mode.id]
                    return (
                      <ToggleGroupItem key={mode.id} className="min-w-[8.5rem] flex-1" disabled value={mode.id}>
                        <Icon data-icon="inline-start" />
                        {mode.label}
                      </ToggleGroupItem>
                    )
                  })}
                </ToggleGroup>
                <FieldDescription>
                  Platform fallback only. Project-level keys in the admin UI take precedence and do not require server restarts.
                </FieldDescription>
              </Field>

              {status.provider === "openai" && (
                <Field>
                  <FieldLabel>Platform embeddings key</FieldLabel>
                  <Input readOnly value={status.apiKeyConfigured ? "Configured on server (fallback)" : "Not configured — use project AI keys instead"} />
                  <FieldDescription>
                    text-embedding-3-small at 1024 dimensions. Prefer per-project keys for security and UI-only operations.
                  </FieldDescription>
                </Field>
              )}

              {status.provider === "local" && (
                <Field>
                  <FieldLabel>Local embedder URL</FieldLabel>
                  <Input readOnly value={status.embedderUrl ?? "Not configured — set EMBEDDER_URL"} />
                  <FieldDescription>
                    Uses the local BGE preset selected by project settings. BGE small is lowest RAM; BGE base is the recommended default.
                  </FieldDescription>
                </Field>
              )}

              <Field>
                <FieldLabel>Smoke test sample</FieldLabel>
                <Input value={sample} onChange={(event) => setSample(event.target.value)} placeholder="Text to embed for a live probe" />
                <FieldDescription>
                  Sends one embedding request through the active provider and validates a {status.dimension}-dimension vector.
                </FieldDescription>
              </Field>
            </FieldGroup>

            {testResult && (
              <Alert>
                <AlertTitle>Smoke test passed in {testResult.latencyMs} ms</AlertTitle>
                <AlertDescription>
                  Model {testResult.model} returned [{testResult.vectorPreview.join(", ")}…] for your sample.
                </AlertDescription>
              </Alert>
            )}

            {testError && (
              <Alert variant="destructive">
                <AlertTitle>Smoke test failed</AlertTitle>
                <AlertDescription>{testError}</AlertDescription>
              </Alert>
            )}

            <Separator />

            <Accordion defaultValue={["openai"]}>
              {status.modes.map((mode) => {
                const Icon = providerIcons[mode.id]
                const isActive = mode.id === status.provider
                return (
                  <AccordionItem key={mode.id} value={mode.id}>
                    <AccordionTrigger>
                      <span className="flex items-center gap-2">
                        <Icon data-icon="inline-start" />
                        {mode.label}
                        {isActive && <Badge variant="secondary">Active</Badge>}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="flex flex-col gap-3 px-4 pb-4">
                      <p className="text-sm text-muted-foreground">{mode.summary}</p>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-lg border p-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Best for</p>
                          <p className="mt-1 text-sm">{mode.bestFor}</p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">RAM</p>
                          <p className="mt-1 text-sm">{mode.ramHint}</p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cost</p>
                          <p className="mt-1 text-sm">{mode.costHint}</p>
                        </div>
                      </div>
                      <div className="rounded-lg border bg-muted/20 p-3 font-mono text-xs">
                        {mode.envVars.map((line) => (
                          <div key={line}>{line}</div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
          </>
        )}
      </CardContent>

      <CardFooter className="flex-wrap gap-2">
        <Button disabled={loading} variant="outline" onClick={() => void loadStatus()}>
          {loading ? <Spinner data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
          Refresh status
        </Button>
        <Button disabled={loading || testing || !status?.configured} onClick={() => void runSmokeTest()}>
          {testing ? <Spinner data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}
          Run smoke test
        </Button>
        {status?.provider === "openai" && (
          <Badge variant="outline">
            <Cpu data-icon="inline-start" />
            Recommended for your 8 GB VPS
          </Badge>
        )}
      </CardFooter>
    </Card>
  )
}
