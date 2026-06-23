import { AspectRatio } from "@workspace/ui/components/aspect-ratio"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { Clipboard } from "lucide-react"
import { useEffect, useState } from "react"

import { api, getErrorMessage } from "@/lib/api"
import { channelDescription } from "@/lib/channels"
import { AlertCallout } from "./components"
import type { Connector, Deployment } from "./types"

export function ConnectView({ chatbotId }: { chatbotId: string }) {
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [deployment, setDeployment] = useState<Deployment | null>(null)
  const [allowedDomainsText, setAllowedDomainsText] = useState("")
  const [websiteUrl, setWebsiteUrl] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [savingDomains, setSavingDomains] = useState(false)
  const [updatingConnector, setUpdatingConnector] = useState("")
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    let cancelled = false
    void api<{ connectors: Connector[]; deployment: Deployment }>(`/admin/chatbots/${chatbotId}/connectors`)
      .then((response) => {
        if (cancelled) return
        setConnectors(response.connectors)
        setDeployment(response.deployment)
        setAllowedDomainsText(response.deployment.allowedDomains.join(", "))
        setWebsiteUrl(response.deployment.allowedDomains[0] ? `https://${response.deployment.allowedDomains[0]}` : "")
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
    setMessage("Website embed snippet copied.")
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
      setDeployment(response.deployment)
      setAllowedDomainsText(response.deployment.allowedDomains.join(", "))
      setWebsiteUrl(response.deployment.allowedDomains[0] ? `https://${response.deployment.allowedDomains[0]}` : websiteUrl)
      setMessage("Allowed website domains saved.")
    } catch (apiError) {
      setError(getErrorMessage(apiError))
    } finally {
      setSavingDomains(false)
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
      setMessage(response.verified ? "Website widget install verified." : "Snippet was not found on that page yet.")
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
      setMessage(`${response.connector.displayName} is ${response.connector.status.replace(/_/g, " ")}.`)
    } catch (apiError) {
      setError(getErrorMessage(apiError))
    } finally {
      setUpdatingConnector("")
    }
  }

  const websiteConnector = connectors.find((connector) => connector.channel === "website")
  const domainsConfigured = Boolean(deployment?.allowedDomains.length)

  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <CardHeader>
          <CardTitle>Website connector</CardTitle>
          <CardDescription>Install this snippet on the business website to load the chatbot widget.</CardDescription>
          <CardAction><Badge variant={websiteConnector?.status === "active" ? "default" : "outline"}>{websiteConnector?.status.replace(/_/g, " ") ?? "Website first"}</Badge></CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {error && <AlertCallout title="Request failed" description={error} variant="destructive" />}
          {message && <AlertCallout title="Done" description={message} />}
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
          </FieldGroup>
        </CardContent>
        <CardFooter className="flex-wrap gap-2">
          <Button disabled={!deployment} onClick={copySnippet}>
            <Clipboard data-icon="inline-start" />
            Copy snippet
          </Button>
          <Button disabled={!deployment || savingDomains} variant="outline" onClick={saveAllowedDomains}>{savingDomains ? "Saving..." : "Save domains"}</Button>
          <Button disabled={!deployment || !domainsConfigured || !websiteUrl || verifying} variant="outline" onClick={verifyInstall}>{verifying ? "Verifying..." : "Verify install"}</Button>
          {websiteConnector?.status === "active" ? (
            <Button disabled={updatingConnector === "website"} variant="outline" onClick={() => updateConnectorStatus("website", "paused")}>
              {updatingConnector === "website" ? "Updating..." : "Pause widget"}
            </Button>
          ) : (
            <Button disabled={updatingConnector === "website"} variant="outline" onClick={() => updateConnectorStatus("website", "active")}>
              {updatingConnector === "website" ? "Updating..." : "Activate widget"}
            </Button>
          )}
        </CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Channel connectors</CardTitle>
          <CardDescription>Website is ready. WhatsApp and Instagram can be plugged in later for the same chatbot.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {connectors.map((connector) => (
            <AspectRatio key={connector.id} ratio={7 / 3} className="min-h-32">
              <Card size="sm" className="h-full shadow-none">
                <CardHeader>
                  <CardTitle>{connector.displayName}</CardTitle>
                  <CardDescription>{channelDescription(connector.channel)}</CardDescription>
                  <CardAction><Badge variant={connector.status === "active" ? "default" : "outline"}>{connector.status.replace(/_/g, " ")}</Badge></CardAction>
                </CardHeader>
                <CardContent className="flex gap-2">
                  {connector.channel !== "website" && (
                    <Button
                      disabled={updatingConnector === connector.channel}
                      size="sm"
                      variant="outline"
                      onClick={() => updateConnectorStatus(connector.channel, connector.status === "paused" ? "needs_credentials" : "paused")}
                    >
                      {connector.status === "paused" ? "Resume setup" : "Pause"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </AspectRatio>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}