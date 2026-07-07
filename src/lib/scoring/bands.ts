/**
 * Nutrition banding tables — Nutri-Score-2023-inspired rule DATA.
 *
 * Everything that decides how many points a nutrient value earns lives here
 * as reviewable data, not inline magic numbers in the algorithm. The point
 * thresholds follow the 2023 update of the Nutri-Score algorithm (Santé
 * publique France / EU steering committee): negative points for energy
 * density, sugars, saturated fat and salt; positive points for protein and
 * fiber; beverages use stricter energy/sugar bands and their own protein
 * bands. This engine is *inspired by* Nutri-Score — it is not a certified
 * Nutri-Score implementation (v1 simplifications: protein always counts,
 * no fruit/veg/legume component because OFF rarely provides it reliably).
 *
 * Banding semantics: a value earns 1 point per threshold it strictly
 * exceeds. Example: sugars thresholds [3.4, 6.8, ...] → 3.4 g = 0 pts,
 * 3.5 g = 1 pt. Missing nutrient → `missingPoints` (mid-band, conservative).
 */

export interface NutrientBands {
  /** Ascending thresholds; points = count of thresholds strictly exceeded. */
  thresholds: readonly number[]
  /** Points assumed when the nutrient is missing (conservative mid-band). */
  missingPoints: number
}

export interface NutritionBandProfile {
  energyKj: NutrientBands
  sugars: NutrientBands
  saturatedFat: NutrientBands
  salt: NutrientBands
  proteins: NutrientBands
  fiber: NutrientBands
}

/** OFF gives kcal; Nutri-Score bands are in kJ. */
export const KJ_PER_KCAL = 4.184

const SATURATED_FAT_BANDS: NutrientBands = {
  thresholds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], // g/100g, max 10 pts
  missingPoints: 5,
}

const SALT_BANDS: NutrientBands = {
  // g/100g in 0.2 g steps (Nutri-Score 2023 extended salt scale), max 20 pts
  thresholds: [
    0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.4, 2.6, 2.8, 3.0,
    3.2, 3.4, 3.6, 3.8, 4.0,
  ],
  missingPoints: 10,
}

const FIBER_BANDS: NutrientBands = {
  thresholds: [3.0, 4.1, 5.2, 6.3, 7.4], // g/100g (AOAC), max 5 pts
  missingPoints: 0, // missing positive = no benefit (conservative)
}

/** General (solid) foods. */
export const SOLID_PROFILE: NutritionBandProfile = {
  energyKj: {
    thresholds: [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350],
    missingPoints: 5,
  },
  sugars: {
    thresholds: [3.4, 6.8, 10, 14, 17, 20, 24, 27, 31, 34, 37, 41, 44, 48, 51],
    missingPoints: 7,
  },
  saturatedFat: SATURATED_FAT_BANDS,
  salt: SALT_BANDS,
  proteins: {
    thresholds: [2.4, 4.8, 7.2, 9.6, 12, 14, 17],
    missingPoints: 0,
  },
  fiber: FIBER_BANDS,
}

/** Beverages — stricter energy and sugar banding (per 100 ml). */
export const BEVERAGE_PROFILE: NutritionBandProfile = {
  energyKj: {
    thresholds: [30, 90, 150, 210, 240, 270, 300, 330, 360, 390],
    missingPoints: 5,
  },
  sugars: {
    thresholds: [0.5, 2, 3.5, 5, 6, 7, 8, 9, 10, 11],
    missingPoints: 5,
  },
  saturatedFat: SATURATED_FAT_BANDS,
  salt: SALT_BANDS,
  proteins: {
    thresholds: [1.2, 1.5, 1.8, 2.1, 2.4, 2.7, 3.0],
    missingPoints: 0,
  },
  fiber: FIBER_BANDS,
}

/**
 * Piecewise-linear mapping from total Nutri-Score-style points (negative −
 * positive; lower = healthier) to the 0–100 nutrition subscore. Anchors are
 * aligned with the 2023 Nutri-Score grade cut-offs and our A≥80 / B≥60 /
 * C≥40 / D≥20 grade bands.
 */
export interface ScoreAnchor {
  points: number
  subscore: number
}

/** Solid foods: Nutri-Score 2023 cut-offs A ≤0, B ≤2, C ≤10, D ≤18, E >18. */
export const SOLID_ANCHORS: readonly ScoreAnchor[] = [
  { points: -6, subscore: 100 },
  { points: 0, subscore: 80 },
  { points: 2.5, subscore: 60 },
  { points: 10.5, subscore: 40 },
  { points: 18.5, subscore: 20 },
  { points: 30, subscore: 0 },
]

/** Beverages: Nutri-Score 2023 cut-offs B ≤2, C ≤6, D ≤9, E >9 (A = water). */
export const BEVERAGE_ANCHORS: readonly ScoreAnchor[] = [
  { points: -4, subscore: 100 },
  { points: 0, subscore: 75 },
  { points: 2.5, subscore: 60 },
  { points: 6.5, subscore: 40 },
  { points: 9.5, subscore: 20 },
  { points: 16, subscore: 0 },
]

/**
 * "High …" flag thresholds (g/100g or g/100ml), v1 rule data. Solid values
 * follow FSA front-of-pack "red" cut-offs; beverage sugar/sat-fat thresholds
 * are tightened in line with the stricter beverage banding above.
 */
export const NUTRIENT_FLAG_THRESHOLDS = {
  solid: { sugars: 22.5, saturatedFat: 5, salt: 1.5 },
  beverage: { sugars: 8, saturatedFat: 2.5, salt: 1.5 },
} as const

/** points = number of thresholds the value strictly exceeds. */
export function bandPoints(value: number | null, bands: NutrientBands): number {
  if (value === null) return bands.missingPoints
  let points = 0
  for (const threshold of bands.thresholds) {
    if (value > threshold) points++
  }
  return points
}

/** Linear interpolation between anchors, clamped to the outer anchors. */
export function subscoreForPoints(
  points: number,
  anchors: readonly ScoreAnchor[],
): number {
  const first = anchors[0]
  const last = anchors[anchors.length - 1]
  if (points <= first.points) return first.subscore
  if (points >= last.points) return last.subscore
  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i - 1]
    const b = anchors[i]
    if (points <= b.points) {
      const t = (points - a.points) / (b.points - a.points)
      return a.subscore + t * (b.subscore - a.subscore)
    }
  }
  return last.subscore
}
