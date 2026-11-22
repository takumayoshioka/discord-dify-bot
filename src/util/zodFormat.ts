import { ResultError, type Result } from "#src/util/result"
import { parse, CsvError } from "csv-parse/sync"
import z from "zod"

export type ZOD_FORMAT_ERROR_NAME = "JSON_SYNTAX_ERROR" | "CSV_PARSE_ERROR" | "ZOD_ERROR"

export type ZodResult<T> = Result<T, ZodFormatErrorReport>

export type ZodFormatErrorReport = {
  name: ZOD_FORMAT_ERROR_NAME,
  message: string,
  raw: string
}

export class ZodResultError extends ResultError {
  override report: ZodFormatErrorReport
  constructor(name: string, report: ZodFormatErrorReport) {
    super(name, report)
    this.report = report
  }

  override toString = () => {
    return `${this.report.name}: ${this.report.message}\n\`\`\`\n${this.report.raw}\n\`\`\``
  }
}

export class DifyEmptyMsg extends Error { }

const zodFormatHandler = (err: unknown, payload: string, raw: string)
  : ZodFormatErrorReport => {
  if (err instanceof SyntaxError) {
    return { name: "JSON_SYNTAX_ERROR", message: payload, raw }
  } else if (err instanceof CsvError) {
    return { name: "CSV_PARSE_ERROR", message: payload, raw }
  } else if (err instanceof z.ZodError) {
    return { name: "ZOD_ERROR", message: payload, raw }
  } else {
    throw err
  }
}

// required JSON format
const difyRequest = z.object({
  query: z.string(),
  inputs: z.record(z.string(), z.unknown()),
  response_mode: z.string(),
  user: z.string().min(1)
})

const difyResponse = z.object({
  answer: z.string()
})

const difyErrorResponse = z.object({
  status: z.number(),
  message: z.string(),
  code: z.string(),
})

const attachmentFile = z.object({
  attachment: z.url(),
  name: z.string()
})

const jsonAttachmentFiles = z.array(attachmentFile)

const googleCredential = z.object({
  client_email: z.string().min(1),
  private_key: z.string().min(1),
})

const csvHeader = ["日本語", "英語", "読み（ひらがな）", "読み（かたかな）", "日本語（略称）", "英語（略称）"] as const

const glossary = z.record(z.enum(csvHeader), z.string()).array()

export const glossaryColumnLength = csvHeader.length

type JsonRequest = z.infer<typeof difyRequest>
type JsonResponse = z.infer<typeof difyResponse>
type JsonErrorResponse = z.infer<typeof difyErrorResponse>
type JsonAttachmentFiles = z.infer<typeof jsonAttachmentFiles>
type JsonGoogleCredential = z.infer<typeof googleCredential>
type CSVGlossary = z.infer<typeof glossary>

export const createRequest = (message: string): JsonRequest => {
  return {
    query: message,
    inputs: {},
    response_mode: "blocking",
    user: "discord-translator"
  }
}

export const createResponse = (message: string): JsonResponse => {
  return {
    answer: message,
  }
}

export const getRequest = (
  request: JsonRequest
) => {
  return request.query
}

export const getResponseMessage = (
  request: JsonResponse
) => {
  return request.answer
}

const jsonParserGenerator = <
  T extends JsonRequest | JsonResponse | JsonErrorResponse | JsonAttachmentFiles | JsonGoogleCredential
>(format: z.ZodType<T>, json: string, payload: string)
  : ZodResult<T> => {
  try {
    const parsed = format.parse(JSON.parse(json))
    return {
      status: "Success",
      result: parsed
    }
  } catch (err) {
    return {
      status: "Failure",
      errorReport: zodFormatHandler(err, payload, json)
    }
  }
}

const csvParserGenerator = <
  T extends CSVGlossary
>(format: z.ZodType<T>, csv: string | Buffer<ArrayBufferLike> | Uint8Array<ArrayBufferLike>, payload: string)
  : ZodResult<T> => {
  try {
    const parsed = format.parse(parse<T>(csv, { columns: true, skip_empty_lines: true }))
    return {
      status: "Success",
      result: parsed
    }
  } catch (err) {
    return {
      status: "Failure",
      errorReport: zodFormatHandler(err, payload, csv.toString())
    }
  }
}

export const parseRequest = (json: string) => {
  return jsonParserGenerator(difyRequest, json, "parsing Request")
}

export const parseResponse = (json: string) => {
  const res = jsonParserGenerator(difyResponse, json, "parsing Dify Response")
  if (res.status === "Success" && res.result.answer === "") {
    throw new DifyEmptyMsg
  } else {
    return res
  }
}

export const parseErrorResponse = (json: string) => {
  return jsonParserGenerator(
    difyErrorResponse,
    json,
    "parsing Dify Error Response"
  )
}

export const parseAttachmentFiles = (json: string) => {
  return jsonParserGenerator(
    jsonAttachmentFiles,
    json,
    "parsing JSON of Attachment Files"
  )
}

export const parseGoogleCredential = (json: string) => {
  return jsonParserGenerator(
    googleCredential,
    json,
    "parsing Google Credential"
  )
}

export const parseGlossaryCSV = (csv: string | Buffer<ArrayBufferLike> | Uint8Array<ArrayBufferLike>) => {
  return csvParserGenerator(
    glossary,
    csv,
    "parsing Glossary CSV"
  )
}