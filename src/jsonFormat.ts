import z from "zod";

// required JSON format
const jsonTranslationRequest = z.object({
  inputs: z.object({
    message: z.string()
  }),
  response_mode: z.string(),
  user: z.string()
})

const jsonTranslationResponse = z.object({
  data: z.object({
    outputs: z.object({
      message: z.string()
    })
  }),
})

type JsonTranslationRequest = z.infer<typeof jsonTranslationRequest>;
type JsonTranslationResponse = z.infer<typeof jsonTranslationResponse>;

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

export const parseTranslationRequest = (json: string)
  : JsonTranslationRequest => {
  try {
    const parsed = jsonTranslationRequest.parse(JSON.parse(json));
    return parsed;
  } catch (err) {
    if (err instanceof SyntaxError) {
      throw new Error(
        `Translation API request took invalid JSON.`
      );
    } else if (err instanceof z.ZodError) {
      throw new Error(
        `Translation API request does not match the expected format.`
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
        `Translation API response returned invalid JSON.`
      );
    } else if (err instanceof z.ZodError) {
      throw new Error(
        `Translation API response does not match the expected format.`
      );
    } else {
      throw err;
    }
  }
}

