import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@workspace/ui/components/hover-card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { Slider } from "@workspace/ui/components/slider"
import { Spinner } from "@workspace/ui/components/spinner"
import { Switch } from "@workspace/ui/components/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { Textarea } from "@workspace/ui/components/textarea"
import { CircleHelp, Clipboard, Globe2, MessageCircle, MessagesSquare } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { api, getErrorMessage } from "@/lib/api"
import { channelDescription } from "@/lib/channels"
import { AlertCallout } from "./components"
import type { Connector, Deployment, WidgetPolicy } from "./types"

function connectorIsToggleable(status: string) {
  return status === "active" || status === "paused"
}

function ConnectorStatusSwitch({
  connector,
  disabled,
  onToggle,
}: {
  connector: Connector
  disabled: boolean
  onToggle: (channel: Connector["channel"], active: boolean) => void
}) {
  const toggleable = connectorIsToggleable(connector.status)
  const checked = connector.status === "active"

  return (
    <div className="flex items-center gap-3">
      <Switch
        checked={checked}
        disabled={disabled || !toggleable}
        id={`connector-${connector.channel}`}
        onCheckedChange={(next) => onToggle(connector.channel, next)}
      />
      <Label className="text-sm text-muted-foreground" htmlFor={`connector-${connector.channel}`}>
        {toggleable ? (checked ? "Active" : "Paused") : connector.status.replace(/_/g, " ")}
      </Label>
    </div>
  )
}

export function ConnectView({ chatbotId }: { chatbotId: string }) {
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [deployment, setDeployment] = useState<Deployment | null>(null)
  const [allowedDomainsText, setAllowedDomainsText] = useState("")
  const [websiteUrl, setWebsiteUrl] = useState("")
  const [error, setError] = useState("")
  const [savingDomains, setSavingDomains] = useState(false)
  const [updatingConnector, setUpdatingConnector] = useState("")
  const [verifying, setVerifying] = useState(false)
  const [widgetPolicy, setWidgetPolicy] = useState<WidgetPolicy | null>(null)
  const [originCheckInput, setOriginCheckInput] = useState("")
  const [originCheckResult, setOriginCheckResult] = useState("")
  const [checkingOrigin, setCheckingOrigin] = useState(false)

  useEffect(() => {
    let cancelled = false
    void api<{ connectors: Connector[]; deployment: Deployment; widgetPolicy: WidgetPolicy }>(`/admin/chatbots/${chatbotId}/connectors`)
      .then((response) => {
        if (cancelled) return
        setConnectors(response.connectors)
        setDeployment(response.deployment)
        setWidgetPolicy(response.widgetPolicy)
        setAllowedDomainsText(response.deployment.allowedDomains.join(", "))
        setWebsiteUrl(response.deployment.allowedDomains[0] ? `https://${response.deployment.allowedDomains[0]}` : "")
        setOriginCheckInput(response.deployment.allowedDomains[0] ? `https://${response.deployment.allowedDomains[0]}` : "")
      })
      .catch((apiError) => {
        if (!cancelled) setError(getErrorMessage(apiError))
      })
    return () => {
      cancelled = true
    }
  }, [chatbotId])

  async function copySnippet() {
    if (!deployment) return
    await navigator.clipboard.writeText(deployment.installSnippet)
    toast.success("Website embed snippet copied.")
  }

  async function saveAllowedDomains() {
    setSavingDomains(true)
    setError("")
    try {
      const allowedDomains = allowedDomainsText
        .split(/[\n,]/)
        .map((domain) => domain.trim())
        .filter(Boolean)
      const response = await api<{ deployment: Deployment }>(`/admin/chatbots/${chatbotId}/connectors/website`, {
        method: "PATCH",
        body: { allowedDomains },
      })
      const refreshed = await api<{ connectors: Connector[]; deployment: Deployment; widgetPolicy: WidgetPolicy }>(
        `/admin/chatbots/${chatbotId}/connectors`,
      )
      setConnectors(refreshed.connectors)
      setDeployment(refreshed.deployment)
      setWidgetPolicy(refreshed.widgetPolicy)
      setAllowedDomainsText(response.deployment.allowedDomains.join(", "))
      setWebsiteUrl(response.deployment.allowedDomains[0] ? `https://${response.deployment.allowedDomains[0]}` : websiteUrl)
      setOriginCheckResult("")
      toast.success("Allowed website domains saved.")
    } catch (apiError) {
      setError(getErrorMessage(apiError))
    } finally {
      setSavingDomains(false)
    }
  }

  async function checkOrigin() {
    if (!originCheckInput.trim()) return
    setCheckingOrigin(true)
    setError("")
    setOriginCheckResult("")
    try {
      const response = await api<{
        allowed: boolean
        hostname: string
        reason?: string
        code?: string
      }>(`/admin/chatbots/${chatbotId}/connectors/website/origin-check`, {
        method: "POST",
        body: { origin: originCheckInput },
      })
      const result = response.allowed
        ? `Origin allowed for host ${response.hostname}.`
        : response.reason ?? "Origin is not allowed for this widget."
      setOriginCheckResult(result)
      if (response.allowed) toast.success(result)
      else toast.warning(result)
    } catch (apiError) {
      setError(getErrorMessage(apiError))
    } finally {
      setCheckingOrigin(false)
    }
  }

  async function verifyInstall() {
    if (!deployment || !websiteUrl) return
    setVerifying(true)
    setError("")
    try {
      const response = await api<{ verified: boolean; deployment: Deployment }>(`/admin/chatbots/${chatbotId}/connectors/website/verify`, {
        method: "POST",
        body: { websiteUrl },
      })
      setDeployment(response.deployment)
      if (response.verified) toast.success("Website widget install verified.")
      else toast.warning("Snippet was not found on that page yet.")
    } catch (apiError) {
      setError(getErrorMessage(apiError))
    } finally {
      setVerifying(false)
    }
  }

  async function updateConnectorStatus(channel: Connector["channel"], status: string) {
    setUpdatingConnector(channel)
    setError("")
    try {
      const response = await api<{ connector: Connector }>(`/admin/chatbots/${chatbotId}/connectors/${channel}/status`, {
        method: "PATCH",
        body: { status },
      })
      setConnectors((current) => current.map((connector) => connector.id === response.connector.id ? response.connector : connector))
      toast.success(`${response.connector.displayName} is ${response.connector.status.replace(/_/g, " ")}.`)
    } catch (apiError) {
      setError(getErrorMessage(apiError))
    } finally {
      setUpdatingConnector("")
    }
  }

  function toggleConnector(channel: Connector["channel"], active: boolean) {
    void updateConnectorStatus(channel, active ? "active" : "paused")
  }

  const websiteConnector = connectors.find((connector) => connector.channel === "website")
  const whatsappConnector = connectors.find((connector) => connector.channel === "whatsapp")
  const instagramConnector = connectors.find((connector) => connector.channel === "instagram_dm")
  const domainsConfigured = Boolean(deployment?.allowedDomains.length)
  const installStatusLabel = deployment?.installStatus?.replace(/_/g, " ") ?? "unknown"

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-heading text-base font-medium">Connect channels</h2>
        <p className="text-sm text-muted-foreground">Deploy the website widget and prepare Meta channels for this chatbot.</p>
      </div>

      {error && <AlertCallout title="Request failed" description={error} variant="destructive" />}

      <Tabs defaultValue="website">
        <TabsList>
          <TabsTrigger value="website">
            <Globe2 data-icon="inline-start" />
            Website
          </TabsTrigger>
          <TabsTrigger value="whatsapp">
            <MessageCircle data-icon="inline-start" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="instagram">
            <MessagesSquare data-icon="inline-start" />
            Instagram
          </TabsTrigger>
        </TabsList>

        <TabsContent value="website" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Website widget</CardTitle>
              <CardDescription>Install this snippet on the business website to load the chatbot widget.</CardDescription>
              <div className="flex flex-wrap gap-2 pt-1">
                <HoverCard>
                  <HoverCardTrigger render={<Badge className="cursor-default" variant={websiteConnector?.status === "active" ? "default" : "outline"} />}>
                    {websiteConnector?.status.replace(/_/g, " ") ?? "Website first"}
                  </HoverCardTrigger>
                  <HoverCardContent>
                    <p className="text-sm text-muted-foreground">
                      {websiteConnector?.status === "active"
                        ? "The widget accepts public traffic on allowed domains."
                        : "Pause stops widget traffic without removing the embed snippet."}
                    </p>
                  </HoverCardContent>
                </HoverCard>
                <HoverCard>
                  <HoverCardTrigger render={<Badge className="cursor-default" variant={deployment?.installStatus === "installed" ? "default" : "outline"} />}>
                    {installStatusLabel}
                  </HoverCardTrigger>
                  <HoverCardContent>
                    <p className="text-sm text-muted-foreground">
                      Install verification checks whether the embed snippet is present on the saved website URL.
                    </p>
                  </HoverCardContent>
                </HoverCard>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {websiteConnector && (
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-muted/30 px-4 py-3">
                  <div>
                    <div className="font-medium">Widget status</div>
                    <p className="text-sm text-muted-foreground">Pause to stop public widget traffic without removing the embed.</p>
                  </div>
                  <ConnectorStatusSwitch
                    connector={websiteConnector}
                    disabled={updatingConnector === "website"}
                    onToggle={toggleConnector}
                  />
                </div>
              )}
              {!domainsConfigured && (
                <AlertCallout
                  title="Website domain required"
                  description="Add at least one allowed domain before installing the widget. Public chat stays blocked until this is saved."
                  variant="destructive"
                />
              )}
              <FieldGroup>
                <Field>
                  <FieldLabel>Public key</FieldLabel>
                  <Input readOnly value={deployment?.publicKey ?? ""} />
                </Field>
                <Field>
                  <FieldLabel>Allowed website domains</FieldLabel>
                  <Textarea
                    className="min-h-20"
                    placeholder="business.example, www.business.example"
                    value={allowedDomainsText}
                    onChange={(event) => setAllowedDomainsText(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel>Install snippet</FieldLabel>
                  <Textarea readOnly className="min-h-28 font-mono text-xs" value={deployment?.installSnippet ?? ""} />
                </Field>
                <Field>
                  <FieldLabel>Website URL to verify</FieldLabel>
                  <Input placeholder="https://business.example" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} />
                </Field>
                <Field>
                  <FieldLabel>Origin check (CORS gate)</FieldLabel>
                  <Input
                    placeholder="https://business.example or business.example"
                    value={originCheckInput}
                    onChange={(event) => setOriginCheckInput(event.target.value)}
                  />
                </Field>
                {originCheckResult && <AlertCallout title="Origin check" description={originCheckResult} />}
                {widgetPolicy && (
                  <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/30 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">Widget security policy</div>
                      <Popover>
                        <PopoverTrigger render={<Button aria-label="Widget policy help" size="icon-sm" variant="ghost" />}>
                          <CircleHelp data-icon="inline-start" />
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-80">
                          <PopoverHeader>
                            <PopoverTitle>Origin and rate limits</PopoverTitle>
                            <PopoverDescription>
                              Visitors on unlisted domains receive ORIGIN_NOT_ALLOWED. Excessive messages receive WIDGET_RATE_LIMITED (429).
                            </PopoverDescription>
                          </PopoverHeader>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Origin protection is {widgetPolicy.originProtection.replace(/_/g, " ")}. {widgetPolicy.rateLimit.summary}.
                    </p>
                    <Field>
                      <FieldLabel>Rate limit window</FieldLabel>
                      <Slider
                        max={widgetPolicy.rateLimit.maxMessages}
                        min={1}
                        step={1}
                        value={[widgetPolicy.rateLimit.maxMessages]}
                        disabled
                      />
                      <FieldDescription>
                        Up to {widgetPolicy.rateLimit.maxMessages} messages per {Math.round(widgetPolicy.rateLimit.windowMs / 1000)}s per visitor session.
                      </FieldDescription>
                    </Field>
                  </div>
                )}
              </FieldGroup>
            </CardContent>
            <CardFooter className="flex-wrap gap-2">
              <Button disabled={!deployment} onClick={() => void copySnippet()}>
                <Clipboard data-icon="inline-start" />
                Copy snippet
              </Button>
              <Button disabled={!deployment || savingDomains} variant="outline" onClick={() => void saveAllowedDomains()}>
                {savingDomains && <Spinner data-icon="inline-start" />}
                Save domains
              </Button>
              <Button disabled={!deployment || !domainsConfigured || !websiteUrl || verifying} variant="outline" onClick={() => void verifyInstall()}>
                {verifying && <Spinner data-icon="inline-start" />}
                Verify install
              </Button>
              <Button disabled={!deployment || !originCheckInput.trim() || checkingOrigin} variant="outline" onClick={() => void checkOrigin()}>
                {checkingOrigin && <Spinner data-icon="inline-start" />}
                Check origin
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp" className="mt-4">
          {whatsappConnector && (
            <Card>
              <CardHeader>
                <CardTitle>{whatsappConnector.displayName}</CardTitle>
                <CardDescription>{channelDescription(whatsappConnector.channel)}</CardDescription>
                <Badge className="w-fit" variant={whatsappConnector.status === "active" ? "default" : "outline"}>
                  {whatsappConnector.status.replace(/_/g, " ")}
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  Configure Meta WhatsApp Business credentials on the API server, then activate this connector when ready.
                </p>
                <ConnectorStatusSwitch
                  connector={whatsappConnector}
                  disabled={updatingConnector === "whatsapp"}
                  onToggle={toggleConnector}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="instagram" className="mt-4">
          {instagramConnector && (
            <Card>
              <CardHeader>
                <CardTitle>{instagramConnector.displayName}</CardTitle>
                <CardDescription>{channelDescription(instagramConnector.channel)}</CardDescription>
                <Badge className="w-fit" variant={instagramConnector.status === "active" ? "default" : "outline"}>
                  {instagramConnector.status.replace(/_/g, " ")}
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  Instagram DM replies use the same Meta webhook pipeline. Activate when credentials are configured.
                </p>
                <ConnectorStatusSwitch
                  connector={instagramConnector}
                  disabled={updatingConnector === "instagram_dm"}
                  onToggle={toggleConnector}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}