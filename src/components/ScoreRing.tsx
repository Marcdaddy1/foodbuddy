import { gradeBand, type GradeBand } from '../lib/mock-catalog'

/** Ring + number color per grade band: A/B green territory, C caution, D/E avoid. */
const BAND_CLASS: Record<GradeBand, { stroke: string; text: string }> = {
  A: { stroke: 'stroke-verdict-safe', text: 'text-verdict-safe' },
  B: { stroke: 'stroke-brand-400', text: 'text-brand-700' },
  C: { stroke: 'stroke-verdict-caution', text: 'text-verdict-caution' },
  D: { stroke: 'stroke-verdict-avoid', text: 'text-verdict-avoid' },
  E: { stroke: 'stroke-verdict-avoid', text: 'text-verdict-avoid' },
}

/**
 * ScoreRing (component canon, MASTER.md): 0–100 score with grade band letter
 * (A 80+, B 60–79, C 40–59, D 20–39, E <20). Number + letter inside the ring.
 */
export function ScoreRing({ score, size = 132 }: { score: number; size?: number }) {
  const band = gradeBand(score)
  const cls = BAND_CLASS[band]
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, score))

  return (
    <div
      role="img"
      aria-label={`Health score ${score} out of 100, grade ${band}`}
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 128 128" width={size} height={size} aria-hidden="true">
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          strokeWidth="10"
          className="stroke-ink/10"
        />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          transform="rotate(-90 64 64)"
          className={cls.stroke}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-heading text-3xl font-bold tabular-nums ${cls.text}`}>{score}</span>
        <span className="text-xs font-semibold text-ink-muted">
          Grade <span className={`font-bold ${cls.text}`}>{band}</span>
        </span>
      </div>
    </div>
  )
}
