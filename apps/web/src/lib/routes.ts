import type { Page } from "@/features/admin/types"

export function pageFromPath(pathname: string): Page {
  if (pathname.includes("/projects")) return "projects"
  if (pathname.includes("/settings")) return "settings"
  if (pathname.includes("/knowledge") || pathname.includes("/rag"))
    return "content"
  if (pathname.includes("/connect")) return "connect"
  if (pathname.includes("/conversations") || pathname.includes("/inbox"))
    return "conversations"
  return "projects"
}
