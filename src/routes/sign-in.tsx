import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Leaf } from 'lucide-react'
import { supabase } from '../lib/supabase'

export const Route = createFileRoute('/sign-in')({
  component: SignInScreen,
})

type Mode = 'sign-in' | 'sign-up'

/** Official multicolour Google "G" (brand guidelines require it unaltered). */
function GoogleMark() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 48 48">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}

const inputClass =
  'min-h-12 rounded-xl border border-ink/15 bg-surface px-4 text-base text-ink outline-none placeholder:text-ink-muted focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30'

function SignInScreen() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!supabase) {
    return (
      <div className="mx-auto w-full max-w-md px-4 pt-[calc(24px+env(safe-area-inset-top))]">
        <section className="rounded-2xl border border-accent-500/40 bg-surface p-5 shadow-[0_8px_32px_rgba(23,29,20,0.08)]">
          <h1 className="text-lg font-bold text-ink">Supabase not configured</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Sign-in needs <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>.
            Add them to <code>.env.local</code> and restart the dev server.
          </p>
          <Link
            to="/"
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-on-brand transition-colors active:scale-[0.98]"
          >
            <ArrowLeft aria-hidden="true" size={18} strokeWidth={2} />
            Back home
          </Link>
        </section>
      </div>
    )
  }
  const client = supabase

  async function handleGoogleSignIn() {
    setError(null)
    setNotice(null)
    setSubmitting(true)
    try {
      // Full-page redirect to Google; Supabase sends the user back here.
      // window.location.origin must be allowlisted in Auth > URL Configuration.
      const { error: oauthError } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (oauthError) {
        setError(oauthError.message)
        setSubmitting(false)
      }
      // On success the browser navigates away — no state reset needed.
    } catch {
      setError('Could not start Google sign-in. Try again.')
      setSubmitting(false)
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setSubmitting(true)
    try {
      if (mode === 'sign-in') {
        const { error: signInError } = await client.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) {
          setError(signInError.message)
          return
        }
        await navigate({ to: '/' })
      } else {
        const { data, error: signUpError } = await client.auth.signUp({
          email,
          password,
        })
        if (signUpError) {
          setError(signUpError.message)
          return
        }
        if (data.session) {
          await navigate({ to: '/' })
        } else {
          setNotice('Check your inbox to confirm your email, then sign in.')
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(12px+env(safe-area-inset-top))]">
      <header className="flex items-center gap-2">
        <Link
          to="/"
          aria-label="Back home"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-ink transition-colors hover:bg-surface active:scale-[0.98]"
        >
          <ArrowLeft aria-hidden="true" size={24} strokeWidth={2} />
        </Link>
      </header>

      <div className="mt-4 flex flex-col items-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-700 text-on-brand">
          <Leaf aria-hidden="true" size={28} strokeWidth={2} />
        </span>
        <h1 className="mt-3 text-2xl font-bold text-ink">
          {mode === 'sign-in' ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          {mode === 'sign-in'
            ? 'Sign in to sync your profile and history.'
            : 'Your dietary profile stays private to you.'}
        </p>
      </div>

      <section className="mt-6 rounded-2xl bg-surface p-5 shadow-[0_8px_32px_rgba(23,29,20,0.08)]">
        <button
          type="button"
          disabled={submitting}
          onClick={handleGoogleSignIn}
          className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-ink/15 bg-surface px-5 text-base font-semibold text-ink transition-colors hover:bg-surface-muted active:scale-[0.98] disabled:opacity-60"
        >
          <GoogleMark />
          Continue with Google
        </button>

        <div className="my-4 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-ink/10" />
          <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">or</span>
          <span className="h-px flex-1 bg-ink/10" />
        </div>

        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Password
            <input
              type="password"
              required
              minLength={8}
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </label>

          {error && (
            <p role="alert" className="text-sm font-medium text-danger-500">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="text-sm font-medium text-verdict-safe">
              {notice}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 min-h-12 rounded-xl bg-brand-700 px-5 text-base font-semibold text-on-brand transition-colors active:scale-[0.98] disabled:opacity-60"
          >
            {submitting ? 'Working…' : mode === 'sign-in' ? 'Sign in' : 'Sign up'}
          </button>
        </form>

        <button
          type="button"
          className="mt-4 min-h-11 text-sm font-semibold text-brand-700 underline underline-offset-2"
          onClick={() => {
            setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')
            setError(null)
            setNotice(null)
          }}
        >
          {mode === 'sign-in' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </button>
      </section>
    </div>
  )
}
