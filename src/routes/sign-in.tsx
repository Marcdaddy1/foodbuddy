import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'

export const Route = createFileRoute('/sign-in')({
  component: SignInScreen,
})

type Mode = 'sign-in' | 'sign-up'

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
      <div className="mx-auto w-full max-w-md p-4">
        <section className="rounded-xl border border-accent-500/40 bg-surface p-5 shadow-sm">
          <h1 className="text-lg font-semibold text-accent-500">
            Supabase not configured
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Sign-in needs <code>VITE_SUPABASE_URL</code> and{' '}
            <code>VITE_SUPABASE_ANON_KEY</code>. Add them to{' '}
            <code>.env.local</code> and restart the dev server.
          </p>
          <Link
            to="/"
            className="mt-4 inline-block text-sm font-semibold text-brand-700 underline"
          >
            Back home
          </Link>
        </section>
      </div>
    )
  }
  const client = supabase

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
    <div className="mx-auto w-full max-w-md p-4">
      <section className="rounded-xl bg-surface p-5 shadow-sm">
        <h1 className="text-xl font-bold text-brand-700">
          {mode === 'sign-in' ? 'Sign in' : 'Create your account'}
        </h1>

        <form className="mt-4 flex flex-col gap-3" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-ink/15 bg-surface px-3 py-2 text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30"
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
              className="rounded-lg border border-ink/15 bg-surface px-3 py-2 text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/30"
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
            className="mt-1 rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-400 disabled:opacity-60"
          >
            {submitting
              ? 'Working…'
              : mode === 'sign-in'
                ? 'Sign in'
                : 'Sign up'}
          </button>
        </form>

        <button
          type="button"
          className="mt-4 text-sm font-medium text-brand-700 underline"
          onClick={() => {
            setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')
            setError(null)
            setNotice(null)
          }}
        >
          {mode === 'sign-in'
            ? 'New here? Create an account'
            : 'Already have an account? Sign in'}
        </button>

        <div className="mt-4">
          <Link to="/" className="text-sm text-ink-muted underline">
            Back home
          </Link>
        </div>
      </section>
    </div>
  )
}
