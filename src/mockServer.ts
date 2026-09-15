import { createServer } from "http"
import { buffer } from "stream/consumers"

import {
  createResponse,
  getRequest,
  parseRequest
} from "#src/util/jsonFormat"
import { getWorkflowURL } from "#src/util/difyURL"
import { unwrap } from "#src/util/result"
import { detachVoidPromise } from "#src/util/utilities"

const requestURL = getWorkflowURL()
const host = requestURL.hostname
const port = Number(requestURL.port)

let cnt = 0

const server = createServer((request, response) => {
  const body = async () => {
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

    const rawBody = (await buffer(request)).toString("utf-8")

    try {
      const body = unwrap(parseRequest(rawBody))
      const translatedText = [...getRequest(body)].reverse().join("")

      cnt++
      if (5 <= cnt && cnt < 10) {
        response.writeHead(400, {
          "Content-Type": "application/json; charset=utf-8",
        })
      } else {
        response.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
        })
      }

      response.end(JSON.stringify(
        createResponse(translatedText)
      ))
    } catch (err) {
      response.writeHead(400, {
        "Content-Type": "application/json; charset=utf-8",
      })

      response.end(JSON.stringify({
        error: `Invalid request: \n` + String(err),
      }))
    }
  }
  detachVoidPromise(body)
})

server.listen(port, host, () => {
  console.log(`Mock server: http://${host}:${port}`)
})