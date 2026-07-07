/**
 * Deterministic scoring engine v0 — PLACEHOLDER implementation of the
 * contract in ./types.ts so dependents can integrate against a stable API.
 *
 * The real engine (nutrient banding + additive risk table + NOVA weighting,
 * golden-file tested) replaces the internals of scoreProduct() without
 * changing its signature. Do not add AI or network calls here — ever.
 */

import type { GradeBand, ScoreResult, ScoringInput } from './types'

export type * from './types'

export const RULE_VERSION = 'v0-placeholder'

export function gradeForScore(score: number): GradeBand {
  if (score >= 80) return 'A'
  if (score >= 60) return 'B'
  if (score >= 40) return 'C'
  if (score >= 20) return 'D'
  return 'E'
}

export function scoreProduct(input: ScoringInput): ScoreResult {
  // Crude v0: NOVA-driven baseline so the UI has plausible numbers until
  // the real engine lands. Deterministic, but NOT nutrition science.
  const processing =
    input.novaGroup === null ? 50 : [100, 75, 45, 15][input.novaGroup - 1]
  const additives = Math.max(0, 100 - input.additiveTags.length * 15)
  const sugars = input.nutriments.sugars ?? 0
  const salt = input.nutriments.salt ?? 0
  const satFat = input.nutriments.saturatedFat ?? 0
  const nutrition = Math.max(
    0,
    Math.min(100, 100 - sugars * 1.5 - salt * 15 - satFat * 2),
  )

  const score = Math.round(nutrition * 0.5 + additives * 0.2 + processing * 0.3)

  return {
    score,
    grade: gradeForScore(score),
    breakdown: {
      nutrition: Math.round(nutrition),
      additives: Math.round(additives),
      processing: Math.round(processing),
    },
    ruleVersion: RULE_VERSION,
    flags: [],
    lowConfidence:
      input.novaGroup === null && input.nutriments.energyKcal === null,
  }
}
