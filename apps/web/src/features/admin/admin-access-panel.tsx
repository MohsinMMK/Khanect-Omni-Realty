import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { useState } from "react"

import { adminApiKeyStorageKey, readAdminApiKey } from "@/lib/api"

export function AdminAccessPanel({ onSaved }: { onSaved: () => void }) {
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
    <Card>
      <CardHeader>
        <CardTitle>Admin access required</CardTitle>
        <CardDescription>Enter the production admin API key configured on the API server.</CardDescription>
      </CardHeader>
      <CardContent>
        <Field>
          <FieldLabel>Admin API key</FieldLabel>
          <Input
            autoComplete="off"
            type="password"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") saveKey()
            }}
          />
        </Field>
      </CardContent>
      <CardFooter className="gap-2">
        <Button disabled={!key.trim()} onClick={saveKey}>Unlock admin</Button>
        <Button
          variant="outline"
          onClick={() => {
            setKey("")
            window.localStorage.removeItem(adminApiKeyStorageKey)
          }}
        >
          Clear
        </Button>
      </CardFooter>
    </Card>
  )
}