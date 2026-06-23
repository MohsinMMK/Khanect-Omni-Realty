import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@workspace/ui/components/empty"

export function EmptyState(props: { title: string; body?: string }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{props.title}</EmptyTitle>
        {props.body && <EmptyDescription>{props.body}</EmptyDescription>}
      </EmptyHeader>
      <EmptyContent />
    </Empty>
  )
}

export function AlertCallout(props: { title: string; description: string; variant?: "default" | "destructive" }) {
  return (
    <Alert variant={props.variant ?? "default"}>
      <AlertTitle>{props.title}</AlertTitle>
      <AlertDescription>{props.description}</AlertDescription>
    </Alert>
  )
}