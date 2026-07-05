import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface AuthState {
  session: Session | null
  /** True while the initial session is being resolved. */
  loading: boolean
  /** False when Supabase env vars are missing (Phase-0 dev without backend). */
  isConfigured: boolean
  signOut: () => Promise<void>
}

/** Subscribes to Supabase auth state. Safe when Supabase is not configured. */
export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState<boolean>(supabase !== null)

  useEffect(() => {
    if (!supabase) return
    let cancelled = false

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return
        setSession(data.session)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  return {
    session,
    loading,
    isConfigured: supabase !== null,
    signOut: async () => {
      if (supabase) await supabase.auth.signOut()
    },
  }
}
