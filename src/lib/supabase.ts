import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { env } from './env'

/**
 * Supabase client (typed against the generated Database schema), or `null`
 * when the env vars are absent (local dev before the cloud project exists).
 * UI must handle the null case with a clear "Supabase not configured" state —
 * never crash.
 */
export const supabase: SupabaseClient<Database> | null =
  env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY
    ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
    : null

export const isSupabaseConfigured = supabase !== null
