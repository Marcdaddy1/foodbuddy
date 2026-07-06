import { ChevronRight, FlaskConical, Leaf, ShieldAlert, HelpCircle, Scale, type LucideIcon } from 'lucide-react'
import type { MockIngredient, RiskClass } from '../lib/mock-catalog'

/** Risk chip meta — always icon + label, never color-only (MASTER.md). */
const RISK_META: Record<RiskClass, { label: string; Icon: LucideIcon; text: string; bg: string }> = {
  allergen: { label: 'Allergen', Icon: ShieldAlert, text: 'text-verdict-avoid', bg: 'bg-verdict-avoid/10' },
  additive: { label: 'Additive', Icon: FlaskConical, text: 'text-verdict-caution', bg: 'bg-verdict-caution/10' },
  controversial: { label: 'Debated', Icon: Scale, text: 'text-verdict-caution', bg: 'bg-verdict-caution/10' },
  unknown: { label: 'Unverified', Icon: HelpCircle, text: 'text-ink-muted', bg: 'bg-ink/5' },
  benign: { label: 'Benign', Icon: Leaf, text: 'text-verdict-safe', bg: 'bg-verdict-safe/10' },
}

/**
 * IngredientRow (component canon, MASTER.md): name + risk chip, tappable to
 * open the ingredient detail sheet. 44px minimum target.
 */
export function IngredientRow({
  ingredient,
  onSelect,
}: {
  ingredient: MockIngredient
  onSelect: (ingredient: MockIngredient) => void
}) {
  const meta = RISK_META[ingredient.riskClass]
  return (
    <button
      type="button"
      onClick={() => onSelect(ingredient)}
      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-surface-muted active:scale-[0.98]"
    >
      <span className="text-[15px] text-ink">{ingredient.name}</span>
      <span className="flex shrink-0 items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${meta.bg} ${meta.text}`}
        >
          <meta.Icon aria-hidden="true" size={14} strokeWidth={2} />
          {meta.label}
        </span>
        <ChevronRight aria-hidden="true" size={16} strokeWidth={2} className="text-ink-muted" />
      </span>
    </button>
  )
}
