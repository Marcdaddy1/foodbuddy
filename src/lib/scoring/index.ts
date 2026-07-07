/**
 * Deterministic scoring engine v1 — implements the frozen contract in
 * ./types.ts. Pure, deterministic TypeScript: no AI, no network, no
 * Date.now(). Same input + same RULE_VERSION → same output, forever.
 *
 * Composition:
 *   nutrition  (./nutrition.ts, Nutri-Score-2023-inspired banding) — 50%
 *   additives  (./additives.ts + data/additive-risk.json)          — 25%
 *   processing (./processing.ts, NOVA mapping)                     — 25%
 *
 * Golden-file tested against real OFF products (see ./golden.test.ts and
 * __fixtures__/) — regenerate goldens with scripts/generate-golden.ts after
 * any rule change, sanity-review the diff, and bump RULE_VERSION.
 */

import type { GradeBand, ScoreFlag, ScoreResult, ScoringInput } from './types'
import { assessAdditives } from './additives'
import { isBeverage } from './categories'
import { assessNutrition } from './nutrition'
import { assessProcessing } from './processing'

export type * from './types'

export const RULE_VERSION = 'v1.0.0'

/** Composite weights (documented constant — must sum to 1). */
export const COMPOSITE_WEIGHTS = {
  nutrition: 0.5,
  additives: 0.25,
  processing: 0.25,
} as const

/**
 * Low-confidence rule: ≥2 of the 4 core negative nutrients missing, or
 * NOVA unknown while at least 1 core nutrient is also missing.
 */
function isLowConfidence(
  missingCoreCount: number,
  novaGroup: ScoringInput['novaGroup'],
): boolean {
  return missingCoreCount >= 2 || (novaGroup === null && missingCoreCount >= 1)
}

const SEVERITY_RANK: Readonly<Record<ScoreFlag['severity'], number>> = {
  high: 0,
  warn: 1,
  info: 2,
}

/** Worst-first, stable within severity, deduped by tag (first wins). */
function sortAndDedupeFlags(flags: readonly ScoreFlag[]): ScoreFlag[] {
  const seen = new Set<string>()
  const deduped: ScoreFlag[] = []
  for (const flag of flags) {
    if (seen.has(flag.tag)) continue
    seen.add(flag.tag)
    deduped.push(flag)
  }
  return deduped.sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  )
}

function clamp0to100(value: number): number {
  return Math.min(100, Math.max(0, value))
}

export function gradeForScore(score: number): GradeBand {
  if (score >= 80) return 'A'
  if (score >= 60) return 'B'
  if (score >= 40) return 'C'
  if (score >= 20) return 'D'
  return 'E'
}

export function scoreProduct(input: ScoringInput): ScoreResult {
  const beverage = isBeverage(input.categories)
  const nutrition = assessNutrition(input.nutriments, beverage)
  const additives = assessAdditives(input.additiveTags)
  const processing = assessProcessing(input.novaGroup)

  const lowConfidence = isLowConfidence(
    nutrition.missingCoreCount,
    input.novaGroup,
  )

  const composite = clamp0to100(
    Math.round(
      nutrition.subscore * COMPOSITE_WEIGHTS.nutrition +
        additives.subscore * COMPOSITE_WEIGHTS.additives +
        processing.subscore * COMPOSITE_WEIGHTS.processing,
    ),
  )

  const flags: ScoreFlag[] = [
    ...additives.flags,
    ...nutrition.flags,
    ...processing.flags,
  ]
  if (lowConfidence) {
    flags.push({
      tag: 'limited-data',
      label: 'Limited product data — score is a conservative estimate',
      severity: 'info',
    })
  }

  return {
    score: composite,
    grade: gradeForScore(composite),
    breakdown: {
      nutrition: Math.round(clamp0to100(nutrition.subscore)),
      additives: Math.round(clamp0to100(additives.subscore)),
      processing: Math.round(clamp0to100(processing.subscore)),
    },
    ruleVersion: RULE_VERSION,
    flags: sortAndDedupeFlags(flags),
    lowConfidence,
  }
}
