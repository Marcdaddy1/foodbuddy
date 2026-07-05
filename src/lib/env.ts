import { z } from 'zod'

/**
 * Zod-validated client environment.
 *
 * Everything here is OPTIONAL by design: Phase 0 must boot before the cloud
 * project exists. Consumers (supabase.ts, telemetry.ts) degrade gracefully
 * when a value is missing. If a value IS present but malformed, we fail fast
 * with a readable error instead of shipping a broken client.
 *
 * Reminder: all VITE_* values are public — never put secrets here.
 */
const envSchema = z.object({
  VITE_SUPABASE_URL: z.url({ error: 'VITE_SUPABASE_URL must be a valid URL' }).optional(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  VITE_SENTRY_DSN: z.url({ error: 'VITE_SENTRY_DSN must be a valid URL' }).optional(),
  VITE_POSTHOG_KEY: z.string().min(1).optional(),
  VITE_POSTHOG_HOST: z.url({ error: 'VITE_POSTHOG_HOST must be a valid URL' }).optional(),
})

export type Env = z.infer<typeof envSchema>

/**
 * Parse a raw env object (import.meta.env or a test double).
 * Empty strings are treated as "not set" — CI and .env files often define
 * blank placeholders.
 */
export function parseEnv(raw: Record<string, unknown>): Env {
  const cleaned: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (value !== '') cleaned[key] = value
  }
  const result = envSchema.safeParse(cleaned)
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    throw new Error(`Invalid environment configuration — ${details}`)
  }
  return result.data
}

export const env: Env = parseEnv(import.meta.env)
