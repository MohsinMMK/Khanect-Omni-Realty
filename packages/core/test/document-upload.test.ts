import { describe, expect, it } from "vitest"

import { getSupportedDocumentUploadFormat, supportedDocumentUploadAccept } from "../src/document-upload.js"

describe("document upload formats", () => {
  it("accepts common source document and spreadsheet formats", () => {
    expect(getSupportedDocumentUploadFormat("brochure.docx")).toMatchObject({ kind: "docx" })
    expect(getSupportedDocumentUploadFormat("inventory.xlsx")).toMatchObject({ kind: "spreadsheet" })
    expect(getSupportedDocumentUploadFormat("pricing.xls")).toMatchObject({ kind: "spreadsheet" })
    expect(getSupportedDocumentUploadFormat("guide.pdf")).toMatchObject({ kind: "pdf" })
    expect(getSupportedDocumentUploadFormat("notes.md")).toMatchObject({ kind: "text" })
    expect(supportedDocumentUploadAccept).toContain(".docx")
    expect(supportedDocumentUploadAccept).toContain(".xlsx")
    expect(supportedDocumentUploadAccept).toContain(".pdf")
  })

  it("rejects executable or unknown files", () => {
    expect(getSupportedDocumentUploadFormat("malware.exe")).toBeNull()
    expect(getSupportedDocumentUploadFormat("archive.zip")).toBeNull()
  })
})
