/**
 * Processing subscore (0–100) — NOVA classification mapped to a subscore.
 *
 * NOVA 1 (unprocessed/minimally processed) → 100
 * NOVA 2 (processed culinary ingredients)  → 80
 * NOVA 3 (processed foods)                 → 50
 * NOVA 4 (ultra-processed foods)           → 15
 * unknown                                  → 50 (neutral; contributes to
 *                                            lowConfidence in index.ts)
 */

import type { ScoreFlag, ScoringInput } from './types'

export const PROCESSING_SUBSCORES: Readonly<Record<1 | 2 | 3 | 4, number>> = {
  1: 100,
  2: 80,
  3: 50,
  4: 15,
}

export const PROCESSING_SUBSCORE_UNKNOWN = 50

export interface ProcessingAssessment {
  /** 0–100, higher = better. */
  subscore: number
  flags: ScoreFlag[]
}

export function assessProcessing(
  novaGroup: ScoringInput['novaGroup'],
): ProcessingAssessment {
  if (novaGroup === null) {
    return { subscore: PROCESSING_SUBSCORE_UNKNOWN, flags: [] }
  }
  const flags: ScoreFlag[] =
    novaGroup === 4
      ? [
          {
            tag: 'ultra-processed',
            label: 'Ultra-processed (NOVA 4)',
            severity: 'warn',
          },
        ]
      : []
  // Defensive: the type says 1–4, but this is the boundary where stale cached
  // rows or hand-edited data enter. An unexpected value used to index to
  // `undefined`, which became NaN in the composite and rendered as a
  // plausible-looking grade E instead of failing visibly.
  return { subscore: PROCESSING_SUBSCORES[novaGroup] ?? PROCESSING_SUBSCORE_UNKNOWN, flags }
}
