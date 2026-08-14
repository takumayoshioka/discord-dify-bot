import { env } from "#src/env"
import {
  createRequest,
  getResponseMessage,
  parseErrorResponse,
  parseResponse,
} from "#src/dify/jsonFormat"

export type ApiKeyKind = "translation" | "dajare"

const requestURL = "chat-messages"

export const getWorkflowURL = () => {
  return new URL(requestURL, `${env.BASE_URL}/`)
}

const apiKeySwitch = (kind: ApiKeyKind) => {
  switch (kind) {
    case ("translation"):
      return env.DIFY_API_KEY_TRANS
    case ("dajare"):
      return env.DIFY_API_KEY_TRANS
  }
}

export const createRequestHeader = (kind: ApiKeyKind) => {
  const headers = new Headers({
    "Content-Type": "application/json"
  })

  // set DIFY_API_KEY if it exists
  const key = apiKeySwitch(kind)
  if (key !== undefined) {
    headers.set("Authorization", `Bearer ${key}`)
  }

  return headers
}

class HttpError extends Error { };
class Timeout extends Error { };

// set timeout 
const setTimeoutRace = <T>(
  targetPromise: Promise<T>, timeout: number
) => {
  const timeoutPromise = new Promise<T>((_, reject) => {
    setTimeout(() => {
      reject(new Timeout(`Timeout: ${String(targetPromise)}`))
    }, timeout)
  })

  return Promise.race([
    targetPromise, timeoutPromise
  ])
}

// request for Dify
const difyRequestBody = async (
  kind: ApiKeyKind, message: string
) => {
  let response: Response
  try {
    response = await fetch(getWorkflowURL(), {
      method: "POST",
      headers: createRequestHeader(kind),
      body: JSON.stringify(createRequest(message)),
    })
  } catch (_) {
    throw new HttpError("Network error")
  }

  if (!response.ok) {
    try {
      const errorResponse = parseErrorResponse(await response.text())
      throw new HttpError(`
        ${errorResponse.status}: ${errorResponse.code}\n
        ${errorResponse.message}\n
      `)
    } catch (err) {
      throw new HttpError(`${response.status}: ${response.statusText}`)
    }
  }

  const rawBody = await response.text()
  try {
    const body = parseResponse(rawBody)
    return getResponseMessage(body)
  } catch (err) {
    throw new Error(`Invalid response: \n${err}`)
  }
}

export const difyRequest = async (kind: ApiKeyKind, message: string) => {
  try {
    return await setTimeoutRace(difyRequestBody(kind, message), 15_000)
  } catch (err) {
    if (err instanceof Timeout) {
      return `[Server timeout] original message:\n${message}`
    } else if (err instanceof HttpError) {
      return `[${err.message}] original message:\n${message}`
    } else {
      return `[Unknown error] original message:\n${message}`
    }
  }
}