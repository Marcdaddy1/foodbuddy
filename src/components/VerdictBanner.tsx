import { ShieldCheck, TriangleAlert, OctagonX, type LucideIcon } from 'lucide-react'
import type { Verdict } from '../stores/dietary-profile'

/**
 * Verdict presentation meta. Always icon + text label — color is never the
 * only signal (color-blind requirement, MASTER.md).
 */
const VERDICT_META: Record<
  Verdict,
  { label: string; Icon: LucideIcon; text: string; bg: string; border: string }
> = {
  safe: {
    label: 'Safe for you',
    Icon: ShieldCheck,
    text: 'text-verdict-safe',
    bg: 'bg-verdict-safe/10',
    border: 'border-verdict-safe',
  },
  caution: {
    label: 'Caution',
    Icon: TriangleAlert,
    text: 'text-verdict-caution',
    bg: 'bg-verdict-caution/10',
    border: 'border-verdict-caution',
  },
  avoid: {
    label: 'Avoid',
    Icon: OctagonX,
    text: 'text-verdict-avoid',
    bg: 'bg-verdict-avoid/10',
    border: 'border-verdict-avoid',
  },
}

/** Hero banner on the product verdict screen (component canon, MASTER.md). */
export function VerdictBanner({ verdict, rule }: { verdict: Verdict; rule: string }) {
  const meta = VERDICT_META[verdict]
  return (
    <section
      role="status"
      aria-label={`Verdict: ${meta.label}. ${rule}`}
      className={`flex items-start gap-3 rounded-2xl border p-4 ${meta.bg} ${meta.border}`}
    >
      <meta.Icon aria-hidden="true" size={28} strokeWidth={2} className={`mt-0.5 shrink-0 ${meta.text}`} />
      <div>
        <h2 className={`text-lg font-bold ${meta.text}`}>{meta.label}</h2>
        <p className="mt-0.5 text-sm text-ink">{rule}</p>
      </div>
    </section>
  )
}

/** Compact verdict chip for scan cards and history rows. */
export function VerdictChip({ verdict }: { verdict: Verdict }) {
  const meta = VERDICT_META[verdict]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${meta.bg} ${meta.border} ${meta.text}`}
    >
      <meta.Icon aria-hidden="true" size={14} strokeWidth={2} />
      {meta.label}
    </span>
  )
}
