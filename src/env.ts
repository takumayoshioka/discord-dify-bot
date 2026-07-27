import { z } from "zod";

const envSchema = z.object({
  APP_ENV: z.enum(["mock", "production"]),

  DISCORD_TOKEN: z.string().min(1),
  DISCORD_APP_ID: z.string().min(1),

  BASE_URL: z.url().transform((s) => s.replace(/\$/, "")),
  DIFY_API_KEY: z.string().min(1).optional(),
}).superRefine((v, ctx) => {
  if (v.APP_ENV === "production" && !v.DIFY_API_KEY) {
    ctx.addIssue({
      code: "custom",
      path: ["DIFY_API_KEY"],
      message: "DIFY_API_KEY is required when APP_ENV is production"
    })
  }
});

export const env = envSchema.parse(process.env)