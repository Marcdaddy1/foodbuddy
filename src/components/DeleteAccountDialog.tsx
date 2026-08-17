import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { deleteAccount } from '../lib/account'

/** Typed confirmation — deletion is irreversible, so a stray tap must not do it. */
const CONFIRM_WORD = 'DELETE'

interface Props {
  email: string | null
  onCancel: () => void
  onDeleted: () => void
}

export function DeleteAccountDialog({ email, onCancel, onDeleted }: Props) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel, busy])

  const confirmed = typed.trim().toUpperCase() === CONFIRM_WORD

  async function handleDelete() {
    if (!confirmed || busy) return
    setBusy(true)
    setError(null)
    const result = await deleteAccount()
    if (result.ok) {
      onDeleted()
    } else {
      setError(result.message)
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-account-title"
    >
      <div className="w-full max-w-md rounded-t-2xl bg-surface p-6 pb-[calc(24px+env(safe-area-inset-bottom))] sm:rounded-2xl sm:pb-6">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-500/12 text-danger-500">
          <AlertTriangle aria-hidden="true" size={24} strokeWidth={2} />
        </span>

        <h2
          id="delete-account-title"
          className="mt-3 font-heading text-lg font-bold text-ink"
        >
          Delete your account
        </h2>

        <p className="mt-2 text-sm text-ink-muted">
          This permanently deletes {email ? <strong className="text-ink">{email}</strong> : 'your account'} and
          everything in it: your dietary profile, scan history, favourites, lists,
          and notes.
        </p>
        <p className="mt-2 text-sm font-semibold text-ink">
          This cannot be undone.
        </p>

        <label
          htmlFor="delete-confirm"
          className="mt-4 block text-sm font-medium text-ink"
        >
          Type <span className="font-mono font-bold">{CONFIRM_WORD}</span> to confirm
        </label>
        <input
          id="delete-confirm"
          ref={inputRef}
          type="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={typed}
          disabled={busy}
          onChange={(e) => setTyped(e.target.value)}
          className="mt-1 min-h-12 w-full rounded-xl border border-ink/15 bg-surface px-4 text-base text-ink outline-none focus:border-danger-500 focus:ring-2 focus:ring-danger-500/30 disabled:opacity-60"
        />

        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-danger-500">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={!confirmed || busy}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-danger-500 px-5 text-base font-semibold text-white transition-colors active:scale-[0.98] disabled:opacity-50"
          >
            {busy && (
              <Loader2
                aria-hidden="true"
                size={18}
                strokeWidth={2}
                className="motion-safe:animate-spin"
              />
            )}
            {busy ? 'Deleting…' : 'Delete my account'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="min-h-12 rounded-xl border border-ink/15 px-5 text-base font-semibold text-ink transition-colors hover:bg-surface-muted active:scale-[0.98] disabled:opacity-50"
          >
            Keep my account
          </button>
        </div>
      </div>
    </div>
  )
}
