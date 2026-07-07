/**
 * Scoring engine contract — the stable interface between the deterministic
 * scoring engine (src/lib/scoring/) and the rest of the app.
 *
 * HARD RULE (repo CLAUDE.md): scoring is pure, deterministic TypeScript.
 * No AI, no network, no Date.now() — same input, same output, forever
 * reproducible for a given ruleVersion.
 */

/** Nutrient values per 100 g / 100 ml, normalized from OFF `nutriments`. */
export interface NutrimentsPer100 {
  energyKcal: number | null
  fat: number | null
  saturatedFat: number | null
  carbohydrates: number | null
  sugars: number | null
  proteins: number | null
  salt: number | null
  fiber: number | null
}

export interface ScoringInput {
  nutriments: NutrimentsPer100
  /** NOVA processing level 1–4, null when unknown. */
  novaGroup: 1 | 2 | 3 | 4 | null
  /** OFF additive tags, e.g. ["en:e150d", "en:e322"]. */
  additiveTags: string[]
  /** OFF category tags/slugs — used to detect beverages (different banding). */
  categories: string[]
}

export type GradeBand = 'A' | 'B' | 'C' | 'D' | 'E'

export interface ScoreFlag {
  /** Stable machine tag, e.g. "high-sugar", "additive-high-concern:e150d". */
  tag: string
  /** Short human label shown in the UI, e.g. "High sugar". */
  label: string
  severity: 'info' | 'warn' | 'high'
}

export interface ScoreResult {
  /** Composite 0–100 (higher = better). */
  score: number
  /** A ≥80, B 60–79, C 40–59, D 20–39, E <20 (per design-system MASTER.md). */
  grade: GradeBand
  /** Per-category subscores 0–100 feeding the breakdown bars in the UI. */
  breakdown: {
    nutrition: number
    additives: number
    processing: number
  }
  /** Version of the rule data used — stored with every scan_history row. */
  ruleVersion: string
  /** Noteworthy drivers of the score, worst first. */
  flags: ScoreFlag[]
  /**
   * True when too much input was missing to score meaningfully
   * (score is still returned, computed conservatively from what exists).
   */
  lowConfidence: boolean
}
