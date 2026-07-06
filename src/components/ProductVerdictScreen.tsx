import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  CircleCheck,
  CircleMinus,
  TriangleAlert,
  Database,
  ScanLine,
  PackageSearch,
  type LucideIcon,
} from 'lucide-react'
import {
  findProduct,
  nutrientRows,
  type MockIngredient,
  type TrafficLight,
} from '../lib/mock-catalog'
import { deriveVerdict, useDietaryProfileStore } from '../stores/dietary-profile'
import { VerdictBanner } from './VerdictBanner'
import { ScoreRing } from './ScoreRing'
import { IngredientRow } from './IngredientRow'
import { BottomSheet } from './BottomSheet'

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

/**
 * Product verdict screen — the hero screen of the app. Rendered by
 * /product/$barcode; kept as a plain component so it can be render-tested
 * without the generated route tree.
 */
export function ProductVerdictScreen({ barcode }: { barcode: string }) {
  const product = findProduct(barcode)
  const allergies = useDietaryProfileStore((s) => s.allergies)
  const intolerances = useDietaryProfileStore((s) => s.intolerances)
  const dietPatterns = useDietaryProfileStore((s) => s.dietPatterns)
  const customAvoid = useDietaryProfileStore((s) => s.customAvoid)
  const [selected, setSelected] = useState<MockIngredient | null>(null)

  if (!product) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-[calc(24px+env(safe-area-inset-top))] text-center">
        <PackageSearch aria-hidden="true" size={48} strokeWidth={2} className="mt-12 text-ink-muted" />
        <h1 className="text-xl font-bold text-ink">We don't know this product yet</h1>
        <p className="text-sm text-ink-muted">
          Barcode <span className="font-semibold tabular-nums">{barcode}</span> isn't in our catalog.
          Product lookup goes live with the Phase-1 backend.
        </p>
        <button
          type="button"
          disabled
          title="Coming with the Phase-1 backend"
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

  const verdict = deriveVerdict(product, { allergies, intolerances, dietPatterns, customAvoid })
  const rows = nutrientRows(product.nutriments)

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-[calc(12px+env(safe-area-inset-top))]">
      <header className="flex items-center gap-2">
        <Link
          to="/scan"
          aria-label="Back to scanner"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-ink transition-colors hover:bg-surface active:scale-[0.98]"
        >
          <ArrowLeft aria-hidden="true" size={24} strokeWidth={2} />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-ink">{product.name}</h1>
          <p className="truncate text-sm text-ink-muted">{product.brand}</p>
        </div>
      </header>

      <VerdictBanner verdict={verdict.verdict} rule={verdict.rule} />

      <section className="flex items-center gap-4 rounded-2xl bg-surface p-4 shadow-[0_8px_32px_rgba(23,29,20,0.08)]">
        <ScoreRing score={product.score} />
        <div className="min-w-0">
          <h2 className="font-heading text-base font-bold text-ink">Health score</h2>
          <p className="mt-1 text-sm text-ink-muted">{NOVA_LABEL[product.novaGroup]}</p>
          <p className="mt-2 text-xs text-ink-muted">
            Placeholder score — the deterministic scoring engine arrives in Phase 1.
          </p>
        </div>
      </section>

      <section className="rounded-2xl bg-surface p-4 shadow-[0_8px_32px_rgba(23,29,20,0.08)]">
        <h2 className="font-heading text-base font-bold text-ink">Score breakdown</h2>
        <div className="mt-3 flex flex-col gap-3">
          <CategoryBar label="Nutrition" value={product.categoryScores.nutrition} />
          <CategoryBar label="Additives" value={product.categoryScores.additives} />
          <CategoryBar label="Processing" value={product.categoryScores.processing} />
        </div>
      </section>

      <section className="rounded-2xl bg-surface p-4 shadow-[0_8px_32px_rgba(23,29,20,0.08)]">
        <h2 className="font-heading text-base font-bold text-ink">Ingredients</h2>
        <p className="mt-0.5 text-xs text-ink-muted">Tap an ingredient for details.</p>
        <ul className="mt-2 flex flex-col">
          {product.ingredients.map((ingredient) => (
            <li key={ingredient.name}>
              <IngredientRow ingredient={ingredient} onSelect={setSelected} />
            </li>
          ))}
        </ul>
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
                  {row.value}
                  {row.unit}
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
          Product data from Open Food Facts (ODbL). Last updated {product.offLastFetchedAt}.
          Recipes change — data may lag the shelf.
        </span>
      </p>

      <footer className="rounded-2xl border border-ink/10 bg-surface p-3 text-center text-xs text-ink-muted">
        Informational only, not medical advice. Always check the physical label.
      </footer>

      {selected && (
        <BottomSheet title={selected.name} onClose={() => setSelected(null)}>
          <div className="flex flex-col gap-3 pb-2 text-sm">
            <p className="text-ink">{selected.explanation.summary}</p>
            <p className="text-ink-muted">{selected.explanation.riskNote}</p>
            <p className="rounded-xl bg-surface-muted p-3 text-xs text-ink-muted">
              <span className="font-semibold text-ink">Evidence:</span> {selected.explanation.evidence}{' '}
              Explanations are placeholder copy — AI-drafted, clinician-reviewed explanations arrive
              in a later phase and never affect scores or verdicts.
            </p>
          </div>
        </BottomSheet>
      )}
    </div>
  )
}
