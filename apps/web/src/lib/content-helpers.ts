import type { ContentItem } from "@/features/admin/types"
import { getSupportedDocumentUploadFormat, supportedDocumentUploadAccept } from "@workspace/core/document-upload"

export { supportedDocumentUploadAccept }

const MAX_IMPORTED_DOCUMENT_CHARS = 50000

export interface ExtractedDocumentUpload {
  title: string
  body: string
  contentType: string
}

export function cleanFileTitle(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Uploaded document"
}

export function inferContentType(fileName: string) {
  const name = fileName.toLowerCase()
  if (name.endsWith(".csv") || name.endsWith(".tsv") || name.endsWith(".json") || name.endsWith(".xls") || name.endsWith(".xlsx") || name.endsWith(".xlsm") || name.endsWith(".ods")) return "property"
  if (name.includes("policy") || name.includes("rule")) return "policy"
  if (name.includes("area") || name.includes("guide")) return "area"
  if (name.includes("project")) return "project"
  return "general"
}

export async function extractDocumentUpload(file: File): Promise<ExtractedDocumentUpload> {
  const format = getSupportedDocumentUploadFormat(file.name)
  if (!format) {
    throw new Error(`${file.name} is not a supported document format.`)
  }

  const body = normalizeImportedText(await extractDocumentText(file, format.kind))
  if (!body) {
    throw new Error(`No readable text found in ${file.name}.`)
  }

  return {
    title: cleanFileTitle(file.name),
    body: body.slice(0, MAX_IMPORTED_DOCUMENT_CHARS),
    contentType: inferContentType(file.name),
  }
}

async function extractDocumentText(file: File, kind: "text" | "docx" | "spreadsheet" | "pdf") {
  if (kind === "text") return file.text()
  if (kind === "docx") return extractDocxText(file)
  if (kind === "spreadsheet") return extractSpreadsheetText(file)
  return extractPdfText(file)
}

async function extractDocxText(file: File) {
  const { default: JSZip } = await import("jszip")
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const documentEntries = Object.values(zip.files)
    .filter((entry) => !entry.dir && /^word\/(document|header\d+|footer\d+)\.xml$/i.test(entry.name))

  const xmlParts = await Promise.all(documentEntries.map((entry) => entry.async("text")))
  return xmlParts.map(extractTextFromWordXml).filter(Boolean).join("\n\n")
}

function extractTextFromWordXml(xml: string) {
  const documentXml = new DOMParser().parseFromString(xml, "application/xml")
  const paragraphs = elementsByLocalName(documentXml, "p")
  if (paragraphs.length === 0) {
    return elementsByLocalName(documentXml, "t").map((element) => element.textContent ?? "").join(" ")
  }

  return paragraphs
    .map((paragraph) => elementsByLocalName(paragraph, "t").map((element) => element.textContent ?? "").join(""))
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .join("\n")
}

function elementsByLocalName(root: ParentNode, localName: string) {
  return Array.from(root.querySelectorAll("*")).filter((element) => element.localName === localName || element.tagName.toLowerCase().endsWith(`:${localName}`))
}

async function extractSpreadsheetText(file: File) {
  const XLSX = await import("xlsx")
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" })
  return workbook.SheetNames
    .map((sheetName) => {
      const sheet = workbook.Sheets[sheetName]
      if (!sheet) return ""
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false }).trim()
      return csv ? `Sheet: ${sheetName}\n${csv}` : ""
    })
    .filter(Boolean)
    .join("\n\n")
}

async function extractPdfText(file: File) {
  const pdfjs = await import("pdfjs-dist")
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString()
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const pages: string[] = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const textContent = await page.getTextContent()
    const text = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .trim()
    if (text) pages.push(`Page ${pageNumber}\n${text}`)
  }

  return pages.join("\n\n")
}

function normalizeImportedText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
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
