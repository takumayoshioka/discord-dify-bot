import { readFile, rename, rm, writeFile } from "node:fs/promises"
import { randomUUIDv7 } from "node:crypto"

import { google } from "googleapis"
import { stringify } from "csv-stringify/sync"

import { env } from "#src/env"
import { glossaryColumnLength, parseGoogleCredential } from "#src/util/zodFormat"
import { type Result, type ErrorReport } from "#src/util/result"

export const updateSheetCSV = async (glossaryCSVPath: string, credentialPath: string): Promise<Result<"", ErrorReport>> => {
  const parsedCredential = parseGoogleCredential(
    await readFile(credentialPath, "utf-8")
  )

  let credential
  switch (parsedCredential.status) {
    case "Success": {
      credential = parsedCredential.result
      break
    }
    case "Failure": {
      return parsedCredential
    }
  }

  const auth = new google.auth.JWT({
    email: credential.client_email,
    key: credential.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  })

  const sheets = google.sheets({ version: "v4", auth })
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: env.GLOSSARY_SHEET_ID,
    range: env.GLOSSARY_SHEET_RANGE
  })

  const rows: unknown[][] | null | undefined = res.data.values

  if (!rows || rows.length === 0) {
    throw new Error()
  }

  const records = rows.map((row) =>
    Array.from({ length: glossaryColumnLength }, (_, i) => row[i] ?? ""))

  const csv = stringify(records, {
    cast: {
      string: (s) => s.trim()
    }
  })

  const tmpPath = `${glossaryCSVPath}.${randomUUIDv7()}.tmp`

  try {
    await writeFile(tmpPath, csv, "utf-8")
    await rename(tmpPath, glossaryCSVPath)
  } finally {
    await rm(tmpPath, { force: true })
  }

  return {
    status: "Success",
    result: ""
  }
}