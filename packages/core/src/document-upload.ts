export type DocumentUploadKind = "text" | "docx" | "spreadsheet" | "pdf"

export interface DocumentUploadFormat {
  extension: string
  kind: DocumentUploadKind
  label: string
}

export const supportedDocumentUploadFormats: DocumentUploadFormat[] = [
  { extension: ".txt", kind: "text", label: "Plain text" },
  { extension: ".md", kind: "text", label: "Markdown" },
  { extension: ".markdown", kind: "text", label: "Markdown" },
  { extension: ".csv", kind: "text", label: "CSV" },
  { extension: ".tsv", kind: "text", label: "TSV" },
  { extension: ".json", kind: "text", label: "JSON" },
  { extension: ".html", kind: "text", label: "HTML" },
  { extension: ".htm", kind: "text", label: "HTML" },
  { extension: ".docx", kind: "docx", label: "Word document" },
  { extension: ".xlsx", kind: "spreadsheet", label: "Excel workbook" },
  { extension: ".xls", kind: "spreadsheet", label: "Excel workbook" },
  { extension: ".xlsm", kind: "spreadsheet", label: "Excel workbook" },
  { extension: ".ods", kind: "spreadsheet", label: "OpenDocument spreadsheet" },
  { extension: ".pdf", kind: "pdf", label: "PDF" },
]

export const supportedDocumentUploadAccept = supportedDocumentUploadFormats
  .map((format) => format.extension)
  .join(",")

export function getSupportedDocumentUploadFormat(fileName: string): DocumentUploadFormat | null {
  const normalized = fileName.trim().toLowerCase()
  return supportedDocumentUploadFormats.find((format) => normalized.endsWith(format.extension)) ?? null
}
