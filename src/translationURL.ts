import { env } from "#src/env";

const requestURL = "chat-messages";

export const getWorkflowURL = () => {
  return new URL(requestURL, `${env.BASE_URL}/`);
}

export const createTranslationRequestHeader = () => {
  const headers = new Headers({
    "Content-Type": "application/json"
  });

  // set DIFY_API_KEY if it exists
  if (env.DIFY_API_KEY) {
    headers.set("Authorization", `Bearer ${env.DIFY_API_KEY}`);
  }

  return headers;
}