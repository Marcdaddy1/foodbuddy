import { useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Search, ScanLine } from 'lucide-react'
import { findProduct, gradeBand, MOCK_SCANS, type MockProduct } from '../lib/mock-catalog'
import { deriveVerdict, useDietaryProfileStore } from '../stores/dietary-profile'
import { VerdictChip } from '../components/VerdictBanner'

export const Route = createFileRoute('/history')({
  component: HistoryScreen,
})

interface ScanEntry {
  product: MockProduct
  scannedAt: Date
}

function dayLabel(date: Date): string {
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (sameDay(date, today)) return 'Today'
  if (sameDay(date, yesterday)) return 'Yesterday'
  return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
}

/** Scan history — mock data until scans persist to Supabase (Phase 1). */
function HistoryScreen() {
  const [query, setQuery] = useState('')
  const allergies = useDietaryProfileStore((s) => s.allergies)
  const intolerances = useDietaryProfileStore((s) => s.intolerances)
  const dietPatterns = useDietaryProfileStore((s) => s.dietPatterns)
  const customAvoid = useDietaryProfileStore((s) => s.customAvoid)
  const profile = { allergies, intolerances, dietPatterns, customAvoid }

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const entries: ScanEntry[] = MOCK_SCANS.flatMap((scan) => {
      const product = findProduct(scan.barcode)
      if (!product) return []
      if (
        needle &&
        !product.name.toLowerCase().includes(needle) &&
        !product.brand.toLowerCase().includes(needle)
      ) {
        return []
      }
      return [{ product, scannedAt: scan.scannedAt }]
    }).sort((a, b) => b.scannedAt.getTime() - a.scannedAt.getTime())

    const byDay = new Map<string, ScanEntry[]>()
    for (const entry of entries) {
      const label = dayLabel(entry.scannedAt)
      byDay.set(label, [...(byDay.get(label) ?? []), entry])
    }
    return [...byDay.entries()]
  }, [query])

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-[calc(16px+env(safe-area-inset-top))]">
      <header>
        <h1 className="text-2xl font-bold text-ink">History</h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          Sample scans — your real history syncs once scanning goes live.
        </p>
      </header>

      <div className="relative">
        <Search
          aria-hidden="true"
          size={20}
          strokeWidth={2}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
        />
        <label className="sr-only" htmlFor="history-search">
          Search scans
        </label>
        <input
          id="history-search"
          type="search"
          placeholder="Search by product or brand"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-h-12 w-full rounded-xl border border-ink/15 bg-surface pl-10 pr-4 text-base text-ink placeholder:text-ink-muted focus:border-brand-400 focus:outline-none"
        />
      </div>

      {groups.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-2xl bg-surface p-8 text-center shadow-[0_8px_32px_rgba(23,29,20,0.08)]">
          <ScanLine aria-hidden="true" size={40} strokeWidth={2} className="text-ink-muted" />
          <h2 className="text-base font-bold text-ink">
            {query ? 'No scans match your search' : 'No scans yet'}
          </h2>
          <p className="text-sm text-ink-muted">
            {query ? 'Try a different product or brand name.' : 'Scan your first product to start your history.'}
          </p>
          {!query && (
            <Link
              to="/scan"
              className="mt-1 flex min-h-11 items-center gap-2 rounded-xl bg-brand-700 px-5 font-semibold text-on-brand transition-transform active:scale-[0.98]"
            >
              <ScanLine aria-hidden="true" size={20} strokeWidth={2} />
              Scan a product
            </Link>
          )}
        </section>
      ) : (
        groups.map(([label, entries]) => (
          <section key={label} aria-label={label}>
            <h2 className="px-1 text-sm font-semibold uppercase tracking-wide text-ink-muted">
              {label}
            </h2>
            <ul className="mt-2 flex flex-col gap-2">
              {entries.map(({ product, scannedAt }) => {
                const verdict = deriveVerdict(product, profile)
                return (
                  <li key={`${product.barcode}-${scannedAt.getTime()}`}>
                    <Link
                      to="/product/$barcode"
                      params={{ barcode: product.barcode }}
                      className="flex min-h-11 items-center justify-between gap-3 rounded-2xl bg-surface p-4 shadow-[0_8px_32px_rgba(23,29,20,0.08)] transition-transform active:scale-[0.98]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">
                          {product.name}
                        </span>
                        <span className="block truncate text-xs text-ink-muted">
                          {product.brand} ·{' '}
                          {scannedAt.toLocaleTimeString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span className="text-base font-bold tabular-nums text-ink">
                          {product.score}
                          <span className="text-xs font-semibold text-ink-muted">
                            {' '}
                            · {gradeBand(product.score)}
                          </span>
                        </span>
                        <VerdictChip verdict={verdict.verdict} />
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
