import assert from "node:assert/strict"
import { test } from "node:test"
import * as XLSX from "xlsx"

import { extractDocumentUpload } from "../src/lib/content-helpers.ts"

for (const extension of ["xlsx", "xls", "ods"]) {
  test(`extracts actual ${extension} uploads through the upgraded spreadsheet reader`, async () => {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["Property", "Price"],
        ["Garden Home", 150000],
      ]),
      "Listings"
    )
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([["Visits", "Saturday"]]),
      "Tours"
    )
    const bytes = XLSX.write(workbook, { type: "array", bookType: extension })
    const result = await extractDocumentUpload(
      new File([bytes], `property-list.${extension}`)
    )
    assert.equal(result.title, "property list")
    assert.equal(result.contentType, "property")
    assert.match(
      result.body,
      /Sheet: Listings\nProperty,Price\nGarden Home,150000/
    )
    assert.match(result.body, /Sheet: Tours\nVisits,Saturday/)
  })
}
