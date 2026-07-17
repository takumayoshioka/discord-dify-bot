export type JsonTranslationRequest = {
  inputs: {
    message: string;
  };
  response_mode: string;
  user: string;
}

export type JsonTranslationResponse = {
  data: {
    outputs: {
      message: string;
    }
  }
}

type JsonObject = Record<string, unknown>;

export const createTranslationRequest = (message: string)
  : JsonTranslationRequest => {
  return {
    inputs: {
      message
    },
    response_mode: "blocking",
    user: "discord-translator"
  }
}

export const createTranslationResponse = (message: string)
  : JsonTranslationResponse => {
  return {
    data: {
      outputs: {
        message: message
      }
    },
  }
}

const isJsonObject = (obj: unknown): obj is JsonObject => {
  return typeof obj === "object" && obj !== null;
}

const isJsonTranslationRequest = (obj: unknown)
  : obj is JsonTranslationRequest => {

  if (!isJsonObject(obj)) { return false; }

  const { inputs, response_mode, user } = obj;
  if (!isJsonObject(inputs)) { return false; }

  const { message } = inputs;

  return (
    typeof message === "string" &&
    typeof response_mode === "string" &&
    typeof user === "string"
  );
}

const isJsonTranslationResponse = (obj: unknown)
  : obj is JsonTranslationResponse => {

  if (!isJsonObject(obj)) { return false; }

  const { data } = obj;
  if (!isJsonObject(data)) { return false; }

  const { outputs } = data;
  if (!isJsonObject(outputs)) { return false; }

  const { message } = outputs;
  return typeof message === "string";
}

export const parseTranslationRequest = (json: string)
  : JsonTranslationRequest => {
  try {
    const parsed: unknown = JSON.parse(json);

    if (isJsonTranslationRequest(parsed)) {
      return parsed;
    } else {
      throw new Error()
    }
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(`
        Translation API request does not match the expected format.
        `);
    } else {
      throw new Error(`
        Translation API request took invalid JSON.
        `);
    }
  }
}

export const parseTranslationResponse = (json: string)
  : JsonTranslationResponse => {
  try {
    const parsed: unknown = JSON.parse(json);

    if (isJsonTranslationResponse(parsed)) {
      return parsed;
    } else {
      throw new Error()
    }
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(`
        Translation API response does not match the expected format.
        `);
    } else {
      throw new Error(`
        Translation API response returned invalid JSON.
        `);
    }
  }
}

