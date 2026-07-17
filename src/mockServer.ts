import { createServer } from "http";
import "./jsonFormat.js";
import { createTranslationResponse, parseTranslationRequest } from "./jsonFormat.js";

const host = "127.0.0.1";
const port = 8080;

const server = createServer(async (request, response) => {
  if (
    request.method !== "POST" ||
    request.url !== "/translate"
  ) {
    response.writeHead(404, {
      "Content-Type": "application/json; charset=utf-8"
    });

    response.end(JSON.stringify({
      error: "Not found",
    }))

    return;
  }

  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString("utf-8");

  try {
    const body = parseTranslationRequest(rawBody);
    const translatedText = [...body.inputs.message].reverse().join("");

    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
    });

    response.end(JSON.stringify(
      createTranslationResponse(translatedText)
    ));
  } catch (err) {
    response.writeHead(400, {
      "Content-Type": "application/json; charset=utf-8",
    });

    response.end(JSON.stringify({
      error: `Invalid request: \n${err}`,
    }));
  }
})

server.listen(port, host, () => {
  console.log(`Mock server: http://${host}:${port}`);
})