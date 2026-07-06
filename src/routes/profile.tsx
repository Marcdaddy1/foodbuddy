import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Plus, X, LogIn, ChevronRight } from 'lucide-react'
import {
  ALLERGEN_OPTIONS,
  DIET_PATTERN_OPTIONS,
  INTOLERANCE_OPTIONS,
  SEVERITIES,
  useDietaryProfileStore,
  type AllergySeverity,
} from '../stores/dietary-profile'
import { useAuth } from '../hooks/useAuth'
import { useConsentStore } from '../stores/consent'
import { initAnalytics, disableAnalytics } from '../lib/telemetry'

export const Route = createFileRoute('/profile')({
  component: ProfileScreen,
})

/** Keep in sync with package.json — surfaced here until Capacitor App.getInfo() wires in. */
const APP_VERSION = '0.0.0'

function SectionCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-surface p-4 shadow-[0_8px_32px_rgba(23,29,20,0.08)]">
      <h2 className="font-heading text-base font-bold text-ink">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

function TogglePill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-11 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors active:scale-[0.98] ${
        active
          ? 'border-brand-700 bg-brand-700 text-on-brand'
          : 'border-ink/15 bg-surface text-ink hover:border-brand-400'
      }`}
    >
      {label}
    </button>
  )
}

function ProfileScreen() {
  const { session, loading, isConfigured, signOut } = useAuth()
  const consent = useConsentStore((s) => s.analyticsConsent)
  const grantConsent = useConsentStore((s) => s.grant)
  const denyConsent = useConsentStore((s) => s.deny)

  const allergies = useDietaryProfileStore((s) => s.allergies)
  const intolerances = useDietaryProfileStore((s) => s.intolerances)
  const dietPatterns = useDietaryProfileStore((s) => s.dietPatterns)
  const customAvoid = useDietaryProfileStore((s) => s.customAvoid)
  const toggleAllergy = useDietaryProfileStore((s) => s.toggleAllergy)
  const setAllergySeverity = useDietaryProfileStore((s) => s.setAllergySeverity)
  const toggleIntolerance = useDietaryProfileStore((s) => s.toggleIntolerance)
  const toggleDietPattern = useDietaryProfileStore((s) => s.toggleDietPattern)
  const addCustomAvoid = useDietaryProfileStore((s) => s.addCustomAvoid)
  const removeCustomAvoid = useDietaryProfileStore((s) => s.removeCustomAvoid)

  const [avoidInput, setAvoidInput] = useState('')

  function submitAvoid(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    addCustomAvoid(avoidInput)
    setAvoidInput('')
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-[calc(16px+env(safe-area-inset-top))]">
      <header>
        <h1 className="text-2xl font-bold text-ink">Profile</h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          Your dietary profile drives every verdict. Stored on this device; never sent to analytics.
        </p>
      </header>

      <SectionCard
        title="Allergies"
        hint="Tap to toggle. Products containing these get an Avoid verdict."
      >
        <div className="flex flex-wrap gap-2">
          {ALLERGEN_OPTIONS.map((option) => (
            <TogglePill
              key={option.tag}
              label={option.label}
              active={allergies.some((a) => a.tag === option.tag)}
              onClick={() => toggleAllergy(option.tag)}
            />
          ))}
        </div>
        {allergies.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2 border-t border-ink/10 pt-3">
            {allergies.map((allergy) => {
              const label =
                ALLERGEN_OPTIONS.find((o) => o.tag === allergy.tag)?.label ?? allergy.tag
              return (
                <li key={allergy.tag} className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-ink">{label} severity</span>
                  <label className="sr-only" htmlFor={`severity-${allergy.tag}`}>
                    {label} severity
                  </label>
                  <select
                    id={`severity-${allergy.tag}`}
                    value={allergy.severity}
                    onChange={(e) =>
                      setAllergySeverity(allergy.tag, e.target.value as AllergySeverity)
                    }
                    className="min-h-11 rounded-xl border border-ink/15 bg-surface px-3 text-sm font-semibold text-ink focus:border-brand-400 focus:outline-none"
                  >
                    {SEVERITIES.map((severity) => (
                      <option key={severity} value={severity}>
                        {severity.charAt(0).toUpperCase() + severity.slice(1)}
                      </option>
                    ))}
                  </select>
                </li>
              )
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Intolerances" hint="Products containing these get a Caution verdict.">
        <div className="flex flex-wrap gap-2">
          {INTOLERANCE_OPTIONS.map((option) => (
            <TogglePill
              key={option.id}
              label={option.label}
              active={intolerances.includes(option.id)}
              onClick={() => toggleIntolerance(option.id)}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Diet patterns" hint="Conflicting products get a Caution verdict.">
        <div className="flex flex-wrap gap-2">
          {DIET_PATTERN_OPTIONS.map((option) => (
            <TogglePill
              key={option.id}
              label={option.label}
              active={dietPatterns.includes(option.id)}
              onClick={() => toggleDietPattern(option.id)}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Custom avoid list"
        hint="Ingredients you personally avoid — matched by name."
      >
        <form onSubmit={submitAvoid} className="flex gap-2">
          <label className="sr-only" htmlFor="avoid-input">
            Ingredient to avoid
          </label>
          <input
            id="avoid-input"
            type="text"
            placeholder="e.g. palm oil"
            value={avoidInput}
            onChange={(e) => setAvoidInput(e.target.value)}
            className="min-h-12 w-full rounded-xl border border-ink/15 bg-surface px-4 text-base text-ink placeholder:text-ink-muted focus:border-brand-400 focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Add to avoid list"
            className="flex min-h-12 min-w-12 items-center justify-center rounded-xl bg-brand-700 text-on-brand transition-transform active:scale-[0.98]"
          >
            <Plus aria-hidden="true" size={24} strokeWidth={2} />
          </button>
        </form>
        {customAvoid.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {customAvoid.map((term) => (
              <li key={term}>
                <span className="inline-flex min-h-11 items-center gap-1 rounded-full border border-ink/15 bg-surface-muted py-1 pl-3.5 pr-1 text-sm font-medium text-ink">
                  {term}
                  <button
                    type="button"
                    aria-label={`Remove ${term} from avoid list`}
                    onClick={() => removeCustomAvoid(term)}
                    className="flex min-h-9 min-w-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:text-danger-500"
                  >
                    <X aria-hidden="true" size={16} strokeWidth={2} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Account">
        {loading ? (
          <p className="text-sm text-ink-muted">Checking your session…</p>
        ) : session ? (
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-sm text-ink">
              Signed in as <span className="font-semibold">{session.user.email}</span>
            </p>
            <button
              type="button"
              className="min-h-11 shrink-0 rounded-xl px-3 text-sm font-semibold text-danger-500 transition-colors hover:bg-danger-500/10 active:scale-[0.98]"
              onClick={() => void signOut()}
            >
              Sign out
            </button>
          </div>
        ) : (
          <Link
            to="/sign-in"
            className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-1 transition-colors hover:bg-surface-muted active:scale-[0.98]"
          >
            <span className="flex items-center gap-3">
              <LogIn aria-hidden="true" size={24} strokeWidth={2} className="text-brand-700" />
              <span>
                <span className="block text-sm font-semibold text-ink">
                  {isConfigured ? 'Sign in' : 'Sign in (Supabase not configured)'}
                </span>
                <span className="block text-xs text-ink-muted">
                  Sync your profile and history across devices.
                </span>
              </span>
            </span>
            <ChevronRight aria-hidden="true" size={20} strokeWidth={2} className="text-ink-muted" />
          </Link>
        )}
      </SectionCard>

      <SectionCard
        title="Analytics consent"
        hint="Anonymous usage analytics. Your dietary and allergy data is never included."
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-ink">
            Status:{' '}
            <span className="font-semibold">
              {consent === 'granted' ? 'Allowed' : consent === 'denied' ? 'Declined' : 'Not set'}
            </span>
          </p>
          {consent === 'granted' ? (
            <button
              type="button"
              className="min-h-11 rounded-xl border border-ink/15 px-4 text-sm font-semibold text-ink transition-colors hover:border-danger-500 hover:text-danger-500 active:scale-[0.98]"
              onClick={() => {
                denyConsent()
                disableAnalytics()
              }}
            >
              Turn off
            </button>
          ) : (
            <button
              type="button"
              className="min-h-11 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-on-brand transition-colors active:scale-[0.98]"
              onClick={() => {
                grantConsent()
                initAnalytics()
              }}
            >
              Allow
            </button>
          )}
        </div>
      </SectionCard>

      <p className="pb-2 text-center text-xs text-ink-muted">FoodBuddy v{APP_VERSION} · UI preview build</p>
    </div>
  )
}
