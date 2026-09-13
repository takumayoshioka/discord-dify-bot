import { env } from "#src/env"
import {
  createRequest,
  parseErrorResponse,
  parseResponse,
  type JsonFormatErrorReport,
} from "#src/util/jsonFormat"
import type { Result } from "#src/util/result"

export type DIFY_ERROR_NAME = "RETRY" | "TIMEOUT" | "HTTP_ERROR"

export type DifyResult = Result<string, DifyErrorReport>

export type DifyErrorReport = {
  name: DIFY_ERROR_NAME,
  message: string,
  raw: string | undefined
} | JsonFormatErrorReport

export type DifyKind = "translation" | "dajare"

const requestURL = "chat-messages"

export const getWorkflowURL = () => {
  return new URL(requestURL, `${env.BASE_URL}/`)
}

const apiKeySwitch = (kind: DifyKind) => {
  switch (kind) {
    case ("translation"):
      return env.DIFY_API_KEY_TRANS
    case ("dajare"):
      return env.DIFY_API_KEY_DAJARE
  }
}

export const createRequestHeader = (kind: DifyKind) => {
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

// class HttpError extends Error { };
// class Timeout extends Error { };

// set timeout 
const setTimeoutRaceWithDify = (
  targetPromise: Promise<DifyResult>,
  timeout: number
) => {
  const timeoutPromise = new Promise<DifyResult>((resolve) => {
    setTimeout(() => {
      resolve({
        status: "Failure",
        errorReport: {
          name: "TIMEOUT",
          message: `Timeout in ${timeout} ms`,
          raw: undefined
        }
      })
      // reject(new Timeout(`Timeout: ${String(targetPromise)}`))
    }, timeout)
  })

  return Promise.race([
    targetPromise, timeoutPromise
  ])
}

// request for Dify
const difyRequestBody = async (
  kind: DifyKind, message: string
): Promise<DifyResult> => {
  let response: Response
  try {
    response = await fetch(getWorkflowURL(), {
      method: "POST",
      headers: createRequestHeader(kind),
      body: JSON.stringify(createRequest(message)),
    })
  } catch (_) {
    return {
      status: "Failure",
      errorReport: {
        name: "HTTP_ERROR",
        message: "Failed in fetch",
        raw: undefined
      }
    }
  }

  if (!response.ok) {
    const errorResponse = parseErrorResponse(await response.text())
    switch (errorResponse.status) {
      case ("Success"): {
        const name: DIFY_ERROR_NAME =
          (errorResponse.result.status === 400) ? "RETRY" : "HTTP_ERROR"
        return {
          status: "Failure",
          errorReport: {
            name,
            message: `${errorResponse.result.status}: ${errorResponse.result.code}`,
            raw: errorResponse.result.message
          }
        }
      }

      case ("Failure"): {
        const name: DIFY_ERROR_NAME =
          (response.status === 400) ? "RETRY" : "HTTP_ERROR"
        return {
          status: "Failure",
          errorReport: {
            name,
            message: `${response.status}: ${response.statusText}`,
            raw: undefined
          }
        }
      }
    }
  }

  const rawBody = await response.text()
  const body = parseResponse(rawBody)

  switch (body.status) {
    case ("Success"): {
      return {
        status: "Success",
        result: body.result.answer
      }
    }

    case ("Failure"): {
      return {
        status: "Failure",
        errorReport: body.errorReport
      }
    }
  }
}

export const difyRequest = async (kind: DifyKind, message: string) => {
  return await setTimeoutRaceWithDify(difyRequestBody(kind, message), 15_000)
}