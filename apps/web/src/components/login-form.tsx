import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { KeyRound } from "lucide-react"
import { useState } from "react"

import { adminApiKeyStorageKey, readAdminApiKey } from "@/lib/api"

export function AdminApiKeyLoginForm({
  onSaved,
}: {
  onSaved: () => void
}) {
  const [key, setKey] = useState(() => readAdminApiKey())

  function saveKey() {
    const trimmed = key.trim()
    if (trimmed) {
      window.localStorage.setItem(adminApiKeyStorageKey, trimmed)
    } else {
      window.localStorage.removeItem(adminApiKeyStorageKey)
    }
    onSaved()
  }

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Admin access</CardTitle>
        <CardDescription>
          Unlock the workspace with your production admin API key.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            saveKey()
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="admin-api-key">Admin API key</FieldLabel>
              <Input
                autoComplete="off"
                id="admin-api-key"
                type="password"
                value={key}
                onChange={(event) => setKey(event.target.value)}
              />
              <FieldDescription>Stored locally in this browser only.</FieldDescription>
            </Field>
            <Field>
              <Button className="w-full" disabled={!key.trim()} type="submit">
                <KeyRound data-icon="inline-start" />
                Unlock admin
              </Button>
              <Button
                className="w-full"
                type="button"
                variant="outline"
                onClick={() => {
                  setKey("")
                  window.localStorage.removeItem(adminApiKeyStorageKey)
                }}
              >
                Clear saved key
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}