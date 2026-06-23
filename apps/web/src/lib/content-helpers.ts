import type { ContentItem } from "@/features/admin/types"

export function cleanFileTitle(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Uploaded document"
}

export function inferContentType(fileName: string) {
  const name = fileName.toLowerCase()
  if (name.endsWith(".csv") || name.endsWith(".json")) return "property"
  if (name.includes("policy") || name.includes("rule")) return "policy"
  if (name.includes("area") || name.includes("guide")) return "area"
  if (name.includes("project")) return "project"
  return "general"
}

export function getContentDisplayTitle(item: ContentItem, sourceHost: string | null) {
  if (!isGenericDocumentTitle(item.title)) return item.title
  return sourceHost ? `Source document from ${sourceHost}` : "Uploaded source document"
}

export function getContentSummary(body: string) {
  const meaningfulLine = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !isSourceHeading(line) && !isBareUrl(line))

  return meaningfulLine ? truncateText(cleanSummaryLine(meaningfulLine), 140) : "Imported document draft. Open details to review and refine the answer."
}

export function getContentSourceHost(body: string) {
  const sourceUrl = body.match(/https?:\/\/[^\s)>,]+/i)?.[0]
  if (!sourceUrl) return null
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

export function isGenericDocumentTitle(title: string) {
  return /^doc\d+$/i.test(title.trim()) || /^document\s*\d+$/i.test(title.trim())
}

export function isSourceHeading(line: string) {
  return /^#?\s*doc\d+$/i.test(line) || /^#?\s*doc\d+\s*>\s*source:/i.test(line) || /^>?\s*source:/i.test(line)
}

export function isBareUrl(line: string) {
  return /^https?:\/\/\S+$/i.test(line)
}

export function cleanSummaryLine(line: string) {
  return line.replace(/^>\s*/, "")
}

export function truncateText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value
}