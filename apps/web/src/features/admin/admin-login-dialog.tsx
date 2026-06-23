import { Dialog, DialogContent } from "@workspace/ui/components/dialog"

import { AdminApiKeyLoginForm } from "@/components/login-form"

export function AdminLoginDialog({ onSaved, open }: { onSaved: () => void; open: boolean }) {
  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <AdminApiKeyLoginForm onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  )
}