import z from "zod"

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
  code: z.string(),
  message: z.string(),
  status: z.number()
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

export const parseRequest = (json: string): JsonRequest => {
  try {
    const parsed = difyRequest.parse(JSON.parse(json))
    return parsed
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(
        `Translation API request took invalid JSON.\n
        ${json}`
      )
    } else if (err instanceof z.ZodError) {
      throw new Error(
        `Translation API request does not match the expected format.\n
        ${json}`
      )
    } else {
      throw err
    }
  }
}

export const parseResponse = (json: string): JsonResponse => {
  try {
    const parsed = difyResponse.parse(JSON.parse(json))
    return parsed
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(
        `Translation API response is invalid JSON.\n
        ${json}`
      )
    } else {
      throw err
    }
  }
}

export const parseErrorResponse = (json: string): JsonErrorResponse => {
  try {
    const parsed = difyErrorResponse.parse(JSON.parse(json))
    return parsed
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(
        `Translation API response is invalid JSON.\n
        ${json}`
      )
    } else {
      throw err
    }
  }
}

export const parseAttachmentFiles = (json: string)
  : JsonAttachmentFiles => {
  try {
    const parsed = jsonAttachmentFiles.parse(JSON.parse(json))
    return parsed
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(
        `Attachment file(s) are invalid JSON.\n
        ${json}`
      )
    } else if (err instanceof z.ZodError) {
      throw new Error(
        `Attachment file(s) does not match the expected format.\n
        ${json}`
      )
    } else {
      throw err
    }
  }
}