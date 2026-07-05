import { describe, expect, it } from 'vitest'
import { parseEnv } from './env'

describe('parseEnv', () => {
  it('returns all-undefined config for an empty env (Phase 0 without backend)', () => {
    const env = parseEnv({})
    expect(env.VITE_SUPABASE_URL).toBeUndefined()
    expect(env.VITE_SUPABASE_ANON_KEY).toBeUndefined()
    expect(env.VITE_SENTRY_DSN).toBeUndefined()
    expect(env.VITE_POSTHOG_KEY).toBeUndefined()
  })

  it('treats empty strings as not set', () => {
    const env = parseEnv({
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
    })
    expect(env.VITE_SUPABASE_URL).toBeUndefined()
    expect(env.VITE_SUPABASE_ANON_KEY).toBeUndefined()
  })

  it('passes through valid values', () => {
    const env = parseEnv({
      VITE_SUPABASE_URL: 'https://abc.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'anon-key-123',
      VITE_SENTRY_DSN: 'https://key@o0.ingest.sentry.io/0',
      VITE_POSTHOG_KEY: 'phc_test',
      VITE_POSTHOG_HOST: 'https://eu.i.posthog.com',
    })
    expect(env.VITE_SUPABASE_URL).toBe('https://abc.supabase.co')
    expect(env.VITE_SUPABASE_ANON_KEY).toBe('anon-key-123')
    expect(env.VITE_POSTHOG_HOST).toBe('https://eu.i.posthog.com')
  })

  it('throws a readable error when a present value is malformed', () => {
    expect(() => parseEnv({ VITE_SUPABASE_URL: 'not-a-url' })).toThrow(
      /VITE_SUPABASE_URL/,
    )
  })

  it('strips unknown keys (does not leak arbitrary import.meta.env entries)', () => {
    const env = parseEnv({ DEV: true, MODE: 'test', VITE_RANDOM: 'x' })
    expect(env).not.toHaveProperty('DEV')
    expect(env).not.toHaveProperty('VITE_RANDOM')
  })
})
