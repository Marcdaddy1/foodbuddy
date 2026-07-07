import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  CircleCheck,
  CircleMinus,
  CloudOff,
  Info,
  TriangleAlert,
  Database,
  RefreshCw,
  ScanLine,
  PackageSearch,
  type LucideIcon,
} from 'lucide-react'
import { scoreProduct, type ScoreFlag } from '../lib/scoring'
import { normalizedToScoringInput, type NormalizedIngredient } from '../lib/off'
import type { NutrimentsPer100 } from '../lib/scoring'
import { useProductLookup, ProductNotFoundError } from '../hooks/useProductLookup'
import { recordScan, useInvalidateScanHistory } from '../hooks/useScanHistory'
import { useAuth } from '../hooks/useAuth'
import { deriveVerdict, useDietaryProfileStore } from '../stores/dietary-profile'
import { VerdictBanner } from './VerdictBanner'
import { ScoreRing } from './ScoreRing'
import { IngredientRow } from './IngredientRow'
import { BottomSheet } from './BottomSheet'

type TrafficLight = 'low' | 'medium' | 'high'

const LIGHT_META: Record<TrafficLight, { label: string; Icon: LucideIcon; text: string; bg: string }> = {
  low: { label: 'Low', Icon: CircleCheck, text: 'text-verdict-safe', bg: 'bg-verdict-safe/10' },
  medium: { label: 'Med', Icon: CircleMinus, text: 'text-verdict-caution', bg: 'bg-verdict-caution/10' },
  high: { label: 'High', Icon: TriangleAlert, text: 'text-verdict-avoid', bg: 'bg-verdict-avoid/10' },
}

const NOVA_LABEL: Record<number, string> = {
  1: 'NOVA 1 — unprocessed or minimally processed',
  2: 'NOVA 2 — processed culinary ingredient',
  3: 'NOVA 3 — processed food',
  4: 'NOVA 4 — ultra-processed food',
}

const FLAG_META: Record<ScoreFlag['severity'], { text: string; bg: string; Icon: LucideIcon }> = {
  info: { text: 'text-ink-muted', bg: 'bg-ink/5', Icon: Info },
  warn: { text: 'text-verdict-caution', bg: 'bg-verdict-caution/10', Icon: CircleMinus },
  high: { text: 'text-verdict-avoid', bg: 'bg-verdict-avoid/10', Icon: TriangleAlert },
}

/* ---------------------------------------------------------------------------
 * Nutrition rows (UK FSA per-100g food thresholds; null-safe for OFF gaps)
 * ------------------------------------------------------------------------- */

interface NutrientDisplayRow {
  key: string
  label: string
  unit: string
  value: number | null
  light: TrafficLight | null
}

function light(value: number, low: number, high: number): TrafficLight {
  if (value <= low) return 'low'
  if (value > high) return 'high'
  return 'medium'
}

function nutrientDisplayRows(n: NutrimentsPer100): NutrientDisplayRow[] {
  return [
    { key: 'energy', label: 'Energy', unit: 'kcal', value: n.energyKcal, light: null },
    { key: 'fat', label: 'Fat', unit: 'g', value: n.fat, light: n.fat === null ? null : light(n.fat, 3, 17.5) },
    {
      key: 'saturates',
      label: 'Saturates',
      unit: 'g',
      value: n.saturatedFat,
      light: n.saturatedFat === null ? null : light(n.saturatedFat, 1.5, 5),
    },
    { key: 'carbohydrates', label: 'Carbohydrates', unit: 'g', value: n.carbohydrates, light: null },
    {
      key: 'sugars',
      label: 'Sugars',
      unit: 'g',
      value: n.sugars,
      light: n.sugars === null ? null : light(n.sugars, 5, 22.5),
    },
    { key: 'proteins', label: 'Protein', unit: 'g', value: n.proteins, light: null },
    {
      key: 'salt',
      label: 'Salt',
      unit: 'g',
      value: n.salt,
      light: n.salt === null ? null : light(n.salt, 0.3, 1.5),
    },
    { key: 'fiber', label: 'Fibre', unit: 'g', value: n.fiber, light: null },
  ]
}

function CategoryBar({ label, value }: { label: string; value: number }) {
  const tone = value >= 60 ? 'bg-verdict-safe' : value >= 40 ? 'bg-verdict-caution' : 'bg-verdict-avoid'
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-ink">{label}</span>
        <span className="text-sm font-semibold tabular-nums text-ink-muted">{value}/100</span>
      </div>
      <div
        role="progressbar"
        aria-label={`${label} score`}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-1 h-2 w-full overflow-hidden rounded-full bg-ink/10"
      >
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * Loading / not-found / error states
 * ------------------------------------------------------------------------- */

function ScreenShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-[calc(12px+env(safe-area-inset-top))]">
      {children}
    </div>
  )
}

function BackHeader({ title, subtitle }: { title?: string; subtitle?: string }) {
  return (
    <header className="flex items-center gap-2">
      <Link
        to="/scan"
        aria-label="Back to scanner"
        className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-ink transition-colors hover:bg-surface active:scale-[0.98]"
      >
        <ArrowLeft aria-hidden="true" size={24} strokeWidth={2} />
      </Link>
      <div className="min-w-0">
        {title ? (
          <h1 className="truncate text-xl font-bold text-ink">{title}</h1>
        ) : (
          <div className="h-6 w-40 animate-pulse rounded-md bg-ink/10" />
        )}
        {subtitle !== undefined ? (
          <p className="truncate text-sm text-ink-muted">{subtitle}</p>
        ) : (
          <div className="mt-1 h-4 w-24 animate-pulse rounded-md bg-ink/10" />
        )}
      </div>
    </header>
  )
}

/** Layout-reserving skeleton — same block order/heights as the loaded screen. */
function LoadingSkeleton() {
  return (
    <ScreenShell>
      <BackHeader />
      <p aria-live="polite" className="sr-only">
        Looking up product…
      </p>
      <div aria-hidden="true" className="h-[92px] animate-pulse rounded-2xl bg-ink/10" />
      <div aria-hidden="true" className="h-[164px] animate-pulse rounded-2xl bg-surface shadow-[0_8px_32px_rgba(23,29,20,0.08)]" />
      <div aria-hidden="true" className="h-[180px] animate-pulse rounded-2xl bg-surface shadow-[0_8px_32px_rgba(23,29,20,0.08)]" />
      <div aria-hidden="true" className="h-[240px] animate-pulse rounded-2xl bg-surface shadow-[0_8px_32px_rgba(23,29,20,0.08)]" />
      <div aria-hidden="true" className="h-[320px] animate-pulse rounded-2xl bg-surface shadow-[0_8px_32px_rgba(23,29,20,0.08)]" />
    </ScreenShell>
  )
}

function NotFoundState({ barcode }: { barcode: string }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-[calc(24px+env(safe-area-inset-top))] text-center">
      <PackageSearch aria-hidden="true" size={48} strokeWidth={2} className="mt-12 text-ink-muted" />
      <h1 className="text-xl font-bold text-ink">We don't know this product yet</h1>
      <p className="text-sm text-ink-muted">
        Barcode <span className="font-semibold tabular-nums">{barcode}</span> isn't in Open Food
        Facts or our catalog yet.
      </p>
      <button
        type="button"
        disabled
        title="Community product submissions are coming soon"
        className="min-h-11 rounded-xl bg-surface px-5 font-semibold text-ink-muted shadow-[0_8px_32px_rgba(23,29,20,0.08)] disabled:opacity-60"
      >
        Help us add it (coming soon)
      </button>
      <Link
        to="/scan"
        className="flex min-h-11 items-center gap-2 rounded-xl bg-brand-700 px-5 font-semibold text-on-brand transition-colors active:scale-[0.98]"
      >
        <ScanLine aria-hidden="true" size={20} strokeWidth={2} />
        Try another barcode
      </Link>
    </div>
  )
}

function ErrorState({ barcode, onRetry }: { barcode: string; onRetry: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-[calc(24px+env(safe-area-inset-top))] text-center">
      <CloudOff aria-hidden="true" size={48} strokeWidth={2} className="mt-12 text-ink-muted" />
      <h1 className="text-xl font-bold text-ink">Couldn't look up this product</h1>
      <p className="text-sm text-ink-muted">
        We couldn't reach Open Food Facts for barcode{' '}
        <span className="font-semibold tabular-nums">{barcode}</span>. Check your connection and
        try again.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="flex min-h-11 items-center gap-2 rounded-xl bg-brand-700 px-5 font-semibold text-on-brand transition-colors active:scale-[0.98]"
      >
        <RefreshCw aria-hidden="true" size={20} strokeWidth={2} />
        Retry
      </button>
      <Link
        to="/scan"
        className="flex min-h-11 items-center gap-2 rounded-xl bg-surface px-5 font-semibold text-ink shadow-[0_8px_32px_rgba(23,29,20,0.08)] transition-colors active:scale-[0.98]"
      >
        <ScanLine aria-hidden="true" size={20} strokeWidth={2} />
        Try another barcode
      </Link>
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * Main screen
 * ------------------------------------------------------------------------- */

function formatFetchedAt(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

/**
 * Product verdict screen — the hero screen of the app. Rendered by
 * /product/$barcode; kept as a plain component so it can be render-tested
 * without the generated route tree. Data comes from the Supabase products
 * cache or live Open Food Facts via useProductLookup.
 */
export function ProductVerdictScreen({ barcode }: { barcode: string }) {
  const { data: product, error, isPending, refetch } = useProductLookup(barcode)
  const { session } = useAuth()
  const allergies = useDietaryProfileStore((s) => s.allergies)
  const intolerances = useDietaryProfileStore((s) => s.intolerances)
  const dietPatterns = useDietaryProfileStore((s) => s.dietPatterns)
  const customAvoid = useDietaryProfileStore((s) => s.customAvoid)
  const [selected, setSelected] = useState<NormalizedIngredient | null>(null)
  const invalidateScanHistory = useInvalidateScanHistory()

  const score = useMemo(
    () => (product ? scoreProduct(normalizedToScoringInput(product)) : null),
    [product],
  )
  const verdict = useMemo(
    () =>
      product
        ? deriveVerdict(product, { allergies, intolerances, dietPatterns, customAvoid })
        : null,
    [product, allergies, intolerances, dietPatterns, customAvoid],
  )

  // Persist one scan_history row per product view while signed in.
  // Failures are ignored silently — history must never break the verdict.
  const recordedKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (!session || !product || !score || !verdict) return
    const key = `${session.user.id}:${product.barcode}`
    if (recordedKeyRef.current === key) return
    recordedKeyRef.current = key
    void recordScan({
      userId: session.user.id,
      barcode: product.barcode,
      productId: product.supabaseProductId,
      verdict: verdict.verdict,
      score: score.score,
      ruleVersion: score.ruleVersion,
    }).then((ok) => {
      if (ok) invalidateScanHistory()
    })
  }, [session, product, score, verdict, invalidateScanHistory])

  if (isPending) return <LoadingSkeleton />

  if (!product) {
    if (error instanceof ProductNotFoundError) return <NotFoundState barcode={barcode} />
    return <ErrorState barcode={barcode} onRetry={() => void refetch()} />
  }

  const rows = nutrientDisplayRows(product.nutriments)
  const scoreResult = score as NonNullable<typeof score>
  const verdictResult = verdict as NonNullable<typeof verdict>

  return (
    <ScreenShell>
      <BackHeader title={product.name} subtitle={product.brand || ' '} />

      {product.stale && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-xl border border-verdict-caution bg-verdict-caution/10 p-3 text-xs text-ink"
        >
          <CloudOff aria-hidden="true" size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-verdict-caution" />
          <span>
            <span className="font-semibold">Showing cached data.</span> We couldn't reach Open Food
            Facts — this snapshot is from {formatFetchedAt(product.fetchedAt)} and may be outdated.
          </span>
        </p>
      )}

      <VerdictBanner verdict={verdictResult.verdict} rule={verdictResult.rule} />

      <section className="flex items-center gap-4 rounded-2xl bg-surface p-4 shadow-[0_8px_32px_rgba(23,29,20,0.08)]">
        <ScoreRing score={scoreResult.score} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-base font-bold text-ink">Health score</h2>
            {scoreResult.lowConfidence && (
              <span className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2 py-0.5 text-xs font-semibold text-ink-muted">
                <Info aria-hidden="true" size={12} strokeWidth={2} />
                Limited data
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-ink-muted">
            {product.novaGroup ? NOVA_LABEL[product.novaGroup] : 'Processing level unknown'}
          </p>
          <p className="mt-2 text-xs text-ink-muted">
            Deterministic score (rules {scoreResult.ruleVersion}) — computed on your device, never
            by AI.
          </p>
        </div>
      </section>

      <section className="rounded-2xl bg-surface p-4 shadow-[0_8px_32px_rgba(23,29,20,0.08)]">
        <h2 className="font-heading text-base font-bold text-ink">Score breakdown</h2>
        <div className="mt-3 flex flex-col gap-3">
          <CategoryBar label="Nutrition" value={scoreResult.breakdown.nutrition} />
          <CategoryBar label="Additives" value={scoreResult.breakdown.additives} />
          <CategoryBar label="Processing" value={scoreResult.breakdown.processing} />
        </div>
        {scoreResult.flags.length > 0 && (
          <ul aria-label="Score flags" className="mt-3 flex flex-wrap gap-2">
            {scoreResult.flags.map((flag) => {
              const meta = FLAG_META[flag.severity]
              return (
                <li
                  key={flag.tag}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${meta.bg} ${meta.text}`}
                >
                  <meta.Icon aria-hidden="true" size={14} strokeWidth={2} />
                  {flag.label}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl bg-surface p-4 shadow-[0_8px_32px_rgba(23,29,20,0.08)]">
        <h2 className="font-heading text-base font-bold text-ink">Ingredients</h2>
        {product.ingredients.length > 0 ? (
          <>
            <p className="mt-0.5 text-xs text-ink-muted">Tap an ingredient for details.</p>
            <ul className="mt-2 flex flex-col">
              {product.ingredients.map((ingredient, index) => (
                <li key={`${ingredient.name}-${index}`}>
                  <IngredientRow ingredient={ingredient} onSelect={setSelected} />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">
            No ingredient list available for this product yet. If you have allergies, always check
            the physical label.
          </p>
        )}
      </section>

      <section className="rounded-2xl bg-surface p-4 shadow-[0_8px_32px_rgba(23,29,20,0.08)]">
        <h2 className="font-heading text-base font-bold text-ink">Nutrition per 100g</h2>
        <table className="mt-2 w-full text-sm">
          <thead className="sr-only">
            <tr>
              <th>Nutrient</th>
              <th>Amount</th>
              <th>Level</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-ink/10 first:border-t-0">
                <td className="py-2.5 text-ink">{row.label}</td>
                <td className="py-2.5 text-right font-medium tabular-nums text-ink">
                  {row.value === null ? '—' : `${row.value}${row.unit}`}
                </td>
                <td className="w-20 py-2.5 pl-3 text-right">
                  {row.light && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${LIGHT_META[row.light].bg} ${LIGHT_META[row.light].text}`}
                    >
                      {(() => {
                        const { Icon } = LIGHT_META[row.light]
                        return <Icon aria-hidden="true" size={14} strokeWidth={2} />
                      })()}
                      {LIGHT_META[row.light].label}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="flex items-start gap-2 px-1 text-xs text-ink-muted">
        <Database aria-hidden="true" size={14} strokeWidth={2} className="mt-0.5 shrink-0" />
        <span>
          Product data from Open Food Facts (ODbL). Last updated{' '}
          {formatFetchedAt(product.fetchedAt)}
          {product.source === 'supabase-cache' ? ' (served from our cache)' : ''}. Recipes change —
          data may lag the shelf.
        </span>
      </p>

      <footer className="rounded-2xl border border-ink/10 bg-surface p-3 text-center text-xs text-ink-muted">
        Informational only, not medical advice. Always check the physical label.
      </footer>

      {selected && (
        <BottomSheet title={selected.name} onClose={() => setSelected(null)}>
          <div className="flex flex-col gap-3 pb-2 text-sm">
            {selected.allergenTags.length > 0 && (
              <p className="text-ink">
                Mapped allergens:{' '}
                <span className="font-semibold">
                  {selected.allergenTags.map((tag) => tag.replace(/^en:/, '')).join(', ')}
                </span>
              </p>
            )}
            {selected.riskClass === 'unknown' && (
              <p className="text-ink-muted">
                We couldn't fully verify this ingredient, so it's treated conservatively if you
                have allergies.
              </p>
            )}
            <p className="rounded-xl bg-surface-muted p-3 text-xs text-ink-muted">
              <span className="font-semibold text-ink">Explanation coming soon.</span> AI-drafted,
              clinician-reviewed ingredient explanations arrive in a later phase — they never
              affect scores or verdicts.
            </p>
          </div>
        </BottomSheet>
      )}
    </ScreenShell>
  )
}
