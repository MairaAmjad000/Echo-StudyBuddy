import { z } from 'zod'
import 'dotenv/config'

/** Env vars, validated once at boot. The server refuses to start on bad config. */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  // Some hosts export PORT=0 to mean "pick a port yourself"; treat that as unset.
  PORT: z.coerce.number().int().default(0).transform((n) => (n > 0 ? n : 4000)),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET is required (16+ chars)'),
  JWT_EXPIRES: z.string().default('7d'),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(31).default(12),

  // AI generation (Google AI Studio / Gemini). Leave AI_API_KEY empty to use
  // the built-in rule-based generator. AI_MODEL defaults to the free-tier Flash.
  AI_API_KEY: z.string().default(''),
  AI_MODEL: z.string().default('gemini-2.5-flash'),
})

const parsed = envSchema.safeParse(process.env)
if (!parsed.success) {
  console.error('Invalid environment:\n' + parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n'))
  process.exit(1)
}

export const env = parsed.data
export const isProd = env.NODE_ENV === 'production'

/** JWT lifetime ("7d", "24h", "60m", "3600s") as milliseconds, for the session cookie. */
const UNITS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }
const match = /^(\d+)(s|m|h|d)$/.exec(env.JWT_EXPIRES.trim().toLowerCase())
export const JWT_EXPIRES_MS = match ? Number(match[1]) * UNITS[match[2]] : 7 * 86_400_000
