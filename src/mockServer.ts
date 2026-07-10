import { createServer } from "http";

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
  const body: unknown = JSON.parse(rawBody);

  if (
    typeof body !== "object" ||
    body === null ||
    !("message" in body) ||
    typeof body.message !== "string"
  ) {
    response.writeHead(400, {
      "Content-Type": "application/json; charset=utf-8",
    });

    response.end(JSON.stringify({
      error: "Invalid request",
    }));

    return;
  }

  const translatedText = [...body.message].reverse().join("");

  response.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
  });

  response.end(JSON.stringify({
    translatedText
  }));
})

server.listen(port, host, () => {
  console.log(`Mock server: http://${host}:${port}`);
})