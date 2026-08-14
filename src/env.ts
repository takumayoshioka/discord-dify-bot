import { z } from "zod"

const envSchema = z.object({
  APP_ENV: z.enum(["mock", "production"]),
  DISCORD_GUILD_ID: z.string().min(1),

  DISCORD_TOKEN_TRANS: z.string().min(1),
  DISCORD_APP_ID_TRANS: z.string().min(1),

  DISCORD_TOKEN_DAJARE: z.string().min(1),
  DISCORD_APP_ID_DAJARE: z.string().min(1),

  BASE_URL: z.url().transform((s) => s.replace(/\$/, "")),
  DIFY_API_KEY_TRANS: z.string().min(1).optional(),
  DIFY_API_KEY_DAJARE: z.string().min(1).optional(),
}).superRefine((v, ctx) => {
  if (v.APP_ENV === "production" && !v.DIFY_API_KEY_TRANS) {
    ctx.addIssue({
      code: "custom",
      path: ["DIFY_API_KEY_TRANS"],
      message: "DIFY_API_KEY_TRANS is required when APP_ENV is production"
    })
  }
  if (v.APP_ENV === "production" && !v.DIFY_API_KEY_DAJARE) {
    ctx.addIssue({
      code: "custom",
      path: ["DIFY_API_KEY_DAJARE"],
      message: "DIFY_API_KEY_DAJARE is required when APP_ENV is production"
    })
  }
})

export const env = envSchema.parse(process.env)