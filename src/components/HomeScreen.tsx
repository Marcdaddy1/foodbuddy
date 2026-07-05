import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useAuth } from '../hooks/useAuth'
import { ConsentBanner } from './ConsentBanner'

/**
 * Home screen. Rendered by the `/` route; kept as a plain component so it can
 * be tested without the generated route tree.
 */
export function HomeScreen() {
  const { session, loading, isConfigured, signOut } = useAuth()
  const [crash, setCrash] = useState(false)

  if (crash) {
    // Thrown during render so the Sentry ErrorBoundary catches it
    // (errors thrown inside event handlers bypass React error boundaries).
    throw new Error('FoodBuddy test crash — verifying Sentry wiring')
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-4">
      {!isConfigured && (
        <section className="rounded-xl border border-accent-500/40 bg-surface p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-accent-500">
            Supabase not configured
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Set <code>VITE_SUPABASE_URL</code> and{' '}
            <code>VITE_SUPABASE_ANON_KEY</code> in <code>.env.local</code> to
            enable sign-in. The app shell still runs without a backend.
          </p>
        </section>
      )}

      {loading ? (
        <section className="rounded-xl bg-surface p-5 shadow-sm">
          <p className="text-sm text-ink-muted">Checking your session…</p>
        </section>
      ) : session ? (
        <section className="rounded-xl bg-surface p-5 shadow-sm">
          <h1 className="text-xl font-bold text-brand-700">
            Hello, {session.user.email} 👋 FoodBuddy skeleton is alive
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            You're signed in. Scanning and verdicts arrive in the next phase.
          </p>
          <button
            type="button"
            className="mt-4 rounded-lg bg-surface-muted px-4 py-2 text-sm font-semibold text-ink hover:bg-danger-500/10 hover:text-danger-500"
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </section>
      ) : (
        <section className="rounded-xl bg-surface p-5 shadow-sm">
          <h1 className="text-xl font-bold text-brand-700">
            Welcome to FoodBuddy
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Scan packaged food, get a clear health score and a personal Safe /
            Caution / Avoid verdict.
          </p>
          <Link
            to="/sign-in"
            className="mt-4 inline-block rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-400"
          >
            Sign in
          </Link>
        </section>
      )}

      {import.meta.env.DEV && (
        <section className="rounded-xl border border-dashed border-ink/20 bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Dev tools
          </p>
          <button
            type="button"
            className="mt-2 rounded-lg bg-danger-500 px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            onClick={() => setCrash(true)}
          >
            Test crash
          </button>
        </section>
      )}

      <ConsentBanner />
    </div>
  )
}
