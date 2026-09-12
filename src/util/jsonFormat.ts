import { ResultError, type Result } from "#src/util/result"
import z from "zod"

export type JSON_FORMAT_ERROR_NAME = "JSON_SYNTAX_ERROR" | "ZOD_ERROR"

export type JsonResult<T> = Result<T, JsonFormatErrorReport>

export type JsonFormatErrorReport = {
  name: JSON_FORMAT_ERROR_NAME,
  message: string,
  raw: string
}

export class JsonResultError extends ResultError {
  override report: JsonFormatErrorReport
  constructor(name: string, report: JsonFormatErrorReport) {
    super(name, report)
    this.report = report
  }
}

const jsonFormatHandler = (err: unknown, payload: string, raw: string)
  : JsonFormatErrorReport => {
  if (err instanceof SyntaxError) {
    return { name: "JSON_SYNTAX_ERROR", message: payload, raw }
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
  answer: z.string().min(1)
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

type JsonRequest = z.infer<typeof difyRequest>
type JsonResponse = z.infer<typeof difyResponse>
type JsonErrorResponse = z.infer<typeof difyErrorResponse>
type JsonAttachmentFiles = z.infer<typeof jsonAttachmentFiles>

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

const parserGenerator = <
  T extends JsonRequest | JsonResponse | JsonErrorResponse | JsonAttachmentFiles
>(format: z.ZodType<T>, json: string, payload: string)
  : JsonResult<T> => {
  try {
    const parsed = format.parse(JSON.parse(json))
    return {
      status: "Success",
      result: parsed
    }
  } catch (err) {
    return {
      status: "Failure",
      errorReport: jsonFormatHandler(err, payload, json)
    }
  }
}

export const parseRequest = (json: string) => {
  return parserGenerator(difyRequest, json, "parsing Request")
}

export const parseResponse = (json: string) => {
  return parserGenerator(difyResponse, json, "parsing Dify Response")
}

export const parseErrorResponse = (json: string) => {
  return parserGenerator(
    difyErrorResponse,
    json,
    "parsing Dify Error Response"
  )
}

export const parseAttachmentFiles = (json: string) => {
  return parserGenerator(
    jsonAttachmentFiles,
    json,
    "parsing JSON of Attachment Files"
  )
}
