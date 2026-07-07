import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ScanLine, History, ListChecks, CircleUserRound, ChevronRight, LogIn } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useScanHistory } from '../hooks/useScanHistory'
import { ConsentBanner } from './ConsentBanner'
import { VerdictChip } from './VerdictBanner'
import { findProduct, gradeBand, MOCK_SCANS } from '../lib/mock-catalog'
import { deriveVerdict, useDietaryProfileStore } from '../stores/dietary-profile'

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/**
 * Home screen. Rendered by the `/` route; kept as a plain component so it can
 * be tested without the generated route tree.
 */
export function HomeScreen() {
  const { session, loading, isConfigured, signOut } = useAuth()
  const { data: realScans } = useScanHistory(session?.user.id, 10)
  const allergies = useDietaryProfileStore((s) => s.allergies)
  const intolerances = useDietaryProfileStore((s) => s.intolerances)
  const dietPatterns = useDietaryProfileStore((s) => s.dietPatterns)
  const customAvoid = useDietaryProfileStore((s) => s.customAvoid)
  const [crash, setCrash] = useState(false)

  if (crash) {
    // Thrown during render so the Sentry ErrorBoundary catches it
    // (errors thrown inside event handlers bypass React error boundaries).
    throw new Error('FoodBuddy test crash — verifying Sentry wiring')
  }

  const profile = { allergies, intolerances, dietPatterns, customAvoid }
  const mockScans = MOCK_SCANS.map((scan) => ({
    scan,
    product: findProduct(scan.barcode),
  })).filter((entry) => entry.product !== undefined)

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-[calc(16px+env(safe-area-inset-top))]">
      <header>
        <h1 className="text-2xl font-bold text-ink">{greetingForHour(new Date().getHours())}</h1>
        {loading ? (
          <p className="mt-0.5 text-sm text-ink-muted">Checking your session…</p>
        ) : session ? (
          <p className="mt-0.5 text-sm text-ink-muted">
            Signed in as <span className="font-medium text-ink">{session.user.email}</span>
          </p>
        ) : (
          <p className="mt-0.5 text-sm text-ink-muted">
            Welcome to FoodBuddy — scan food, get a clear verdict.
          </p>
        )}
      </header>

      {!isConfigured && (
        <section className="rounded-2xl border border-accent-500/40 bg-surface p-4 shadow-[0_8px_32px_rgba(23,29,20,0.08)]">
          <h2 className="text-base font-semibold text-ink">Supabase not configured</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in{' '}
            <code>.env.local</code> to enable sign-in. The app shell still runs without a backend.
          </p>
        </section>
      )}

      <Link
        to="/scan"
        className="flex items-center gap-4 rounded-2xl bg-brand-700 p-5 text-on-brand shadow-[0_8px_32px_rgba(23,29,20,0.08)] transition-transform active:scale-[0.98]"
      >
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent-500 text-on-accent">
          <ScanLine aria-hidden="true" size={28} strokeWidth={2} />
        </span>
        <span>
          <span className="block font-heading text-lg font-bold">Scan a product</span>
          <span className="mt-0.5 block text-sm opacity-90">
            Point at a barcode, get your Safe / Caution / Avoid verdict.
          </span>
        </span>
      </Link>

      <section aria-label="Recent scans">
        <div className="flex items-baseline justify-between">
          <h2 className="font-heading text-base font-bold text-ink">Recent scans</h2>
          <Link to="/history" className="flex min-h-11 items-center text-sm font-semibold text-brand-700">
            See all
          </Link>
        </div>
        {session ? (
          realScans && realScans.length > 0 ? (
            <div className="-mx-4 mt-1 flex gap-3 overflow-x-auto px-4 pb-2">
              {realScans.map((entry) => (
                <Link
                  key={entry.id}
                  to="/product/$barcode"
                  params={{ barcode: entry.barcode }}
                  className="w-40 shrink-0 rounded-2xl bg-surface p-4 shadow-[0_8px_32px_rgba(23,29,20,0.08)] transition-transform active:scale-[0.98]"
                >
                  <p className="truncate text-sm font-semibold text-ink">
                    {entry.productName ?? `Barcode ${entry.barcode}`}
                  </p>
                  <p className="truncate text-xs text-ink-muted">{entry.brand ?? ' '}</p>
                  <p className="mt-2 text-lg font-bold tabular-nums text-ink">
                    {entry.score !== null ? (
                      <>
                        {entry.score}
                        <span className="text-xs font-semibold text-ink-muted">
                          {' '}
                          · {gradeBand(entry.score)}
                        </span>
                      </>
                    ) : (
                      '—'
                    )}
                  </p>
                  {entry.verdict && (
                    <div className="mt-1.5">
                      <VerdictChip verdict={entry.verdict} />
                    </div>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-1 rounded-2xl bg-surface p-4 text-sm text-ink-muted shadow-[0_8px_32px_rgba(23,29,20,0.08)]">
              No scans yet — scan your first product and it'll show up here.
            </p>
          )
        ) : (
          <>
            <div className="-mx-4 mt-1 flex gap-3 overflow-x-auto px-4 pb-2">
              {mockScans.map(({ scan, product }) => {
                if (!product) return null
                const verdict = deriveVerdict(product, profile)
                return (
                  <Link
                    key={scan.barcode}
                    to="/product/$barcode"
                    params={{ barcode: scan.barcode }}
                    className="w-40 shrink-0 rounded-2xl bg-surface p-4 shadow-[0_8px_32px_rgba(23,29,20,0.08)] transition-transform active:scale-[0.98]"
                  >
                    <p className="truncate text-sm font-semibold text-ink">{product.name}</p>
                    <p className="truncate text-xs text-ink-muted">{product.brand}</p>
                    <p className="mt-2 text-lg font-bold tabular-nums text-ink">
                      {product.score}
                      <span className="text-xs font-semibold text-ink-muted"> · {gradeBand(product.score)}</span>
                    </p>
                    <div className="mt-1.5">
                      <VerdictChip verdict={verdict.verdict} />
                    </div>
                  </Link>
                )
              })}
            </div>
            <p className="text-xs text-ink-muted">
              Sample data — sign in and scan to see your real history here.
            </p>
          </>
        )}
      </section>

      <section aria-label="Quick actions" className="grid grid-cols-3 gap-3">
        <Link
          to="/history"
          className="flex min-h-11 flex-col items-center gap-1.5 rounded-2xl bg-surface p-4 text-center shadow-[0_8px_32px_rgba(23,29,20,0.08)] transition-transform active:scale-[0.98]"
        >
          <History aria-hidden="true" size={24} strokeWidth={2} className="text-brand-700" />
          <span className="text-xs font-semibold text-ink">History</span>
        </Link>
        <Link
          to="/lists"
          className="flex min-h-11 flex-col items-center gap-1.5 rounded-2xl bg-surface p-4 text-center shadow-[0_8px_32px_rgba(23,29,20,0.08)] transition-transform active:scale-[0.98]"
        >
          <ListChecks aria-hidden="true" size={24} strokeWidth={2} className="text-brand-700" />
          <span className="text-xs font-semibold text-ink">Lists</span>
        </Link>
        <Link
          to="/profile"
          className="flex min-h-11 flex-col items-center gap-1.5 rounded-2xl bg-surface p-4 text-center shadow-[0_8px_32px_rgba(23,29,20,0.08)] transition-transform active:scale-[0.98]"
        >
          <CircleUserRound aria-hidden="true" size={24} strokeWidth={2} className="text-brand-700" />
          <span className="text-xs font-semibold text-ink">Profile</span>
        </Link>
      </section>

      {!loading &&
        (session ? (
          <section className="flex items-center justify-between rounded-2xl bg-surface p-4 shadow-[0_8px_32px_rgba(23,29,20,0.08)]">
            <p className="min-w-0 truncate text-sm text-ink-muted">
              Hello, <span className="font-medium text-ink">{session.user.email}</span>
            </p>
            <button
              type="button"
              className="min-h-11 shrink-0 rounded-xl px-3 text-sm font-semibold text-danger-500 transition-colors hover:bg-danger-500/10 active:scale-[0.98]"
              onClick={() => void signOut()}
            >
              Sign out
            </button>
          </section>
        ) : (
          <Link
            to="/sign-in"
            className="flex items-center justify-between rounded-2xl bg-surface p-4 shadow-[0_8px_32px_rgba(23,29,20,0.08)] transition-transform active:scale-[0.98]"
          >
            <span className="flex items-center gap-3">
              <LogIn aria-hidden="true" size={24} strokeWidth={2} className="text-brand-700" />
              <span>
                <span className="block text-sm font-semibold text-ink">Sign in</span>
                <span className="block text-xs text-ink-muted">
                  Sync your profile and history across devices.
                </span>
              </span>
            </span>
            <ChevronRight aria-hidden="true" size={20} strokeWidth={2} className="text-ink-muted" />
          </Link>
        ))}

      {import.meta.env.DEV && (
        <section className="rounded-2xl border border-dashed border-ink/20 bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Dev tools</p>
          <button
            type="button"
            className="mt-2 min-h-11 rounded-xl border border-danger-500 bg-danger-500/10 px-4 text-sm font-semibold text-danger-500 transition-opacity hover:opacity-90 active:scale-[0.98]"
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
