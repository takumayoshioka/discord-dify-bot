import { createServer } from "http"

import "#src/jsonFormat"
import {
  createTranslationResponse,
  getTranslationRequestMessage,
  parseTranslationRequest
} from "#src/jsonFormat"
import { getWorkflowURL } from "#src/translationURL"

const requestURL = getWorkflowURL()
const host = requestURL.hostname
const port = Number(requestURL.port)

const server = createServer(async (request, response) => {
  if (
    request.method !== "POST" ||
    request.url !== requestURL.pathname
  ) {
    response.writeHead(404,
      {
        "Content-Type": "application/json; charset=utf-8"
      })

    response.end(JSON.stringify({
      error: "Not found",
    }))

    return
  }

  const chunks: Buffer[] = []

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  const rawBody = Buffer.concat(chunks).toString("utf-8")

  try {
    const body = parseTranslationRequest(rawBody)
    const translatedText =
      [...getTranslationRequestMessage(body)].reverse().join("")

    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
    })

    response.end(JSON.stringify(
      createTranslationResponse(translatedText)
    ))
  } catch (err) {
    response.writeHead(400, {
      "Content-Type": "application/json; charset=utf-8",
    })

    response.end(JSON.stringify({
      error: `Invalid request: \n${err}`,
    }))
  }
})

server.listen(port, host, () => {
  console.log(`Mock server: http://${host}:${port}`)
})