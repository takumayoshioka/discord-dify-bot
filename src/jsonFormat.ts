import z from "zod";

// required JSON format
const jsonTranslationRequest = z.object({
  query: z.string(),
  inputs: z.record(z.string(), z.unknown()),
  response_mode: z.string(),
  user: z.string().min(1)
})

const jsonTranslationResponse = z.object({
  answer: z.string().min(1)
})

type JsonTranslationRequest = z.infer<typeof jsonTranslationRequest>;
type JsonTranslationResponse = z.infer<typeof jsonTranslationResponse>;

export const createTranslationRequest = (message: string)
  : JsonTranslationRequest => {
  return {
    query: message,
    inputs: {},
    response_mode: "blocking",
    user: "discord-translator"
  }
}

export const createTranslationResponse = (message: string)
  : JsonTranslationResponse => {
  return {
    answer: message,
  }
}

export const getTranslationRequestMessage = (
  request: JsonTranslationRequest
) => {
  return request.query;
}

export const getTranslationResponseMessage = (
  request: JsonTranslationResponse
) => {
  return request.answer;
}

export const parseTranslationRequest = (json: string)
  : JsonTranslationRequest => {
  try {
    const parsed = jsonTranslationRequest.parse(JSON.parse(json));
    return parsed;
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(
        `Translation API request took invalid JSON.\n
        ${json}`
      );
    } else if (err instanceof z.ZodError) {
      throw new Error(
        `Translation API request does not match the expected format.\n
        ${json}`
      );
    } else {
      throw err;
    }
  }
}

export const parseTranslationResponse = (json: string)
  : JsonTranslationResponse => {
  try {
    const parsed = jsonTranslationResponse.parse(JSON.parse(json));
    return parsed;
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(
        `Translation API response returned invalid JSON.\n
        ${json}`
      );
    } else if (err instanceof z.ZodError) {
      throw new Error(
        `Translation API response does not match the expected format.\n
        ${json}`
      );
    } else {
      throw err;
    }
  }
}

