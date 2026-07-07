/**
 * Nutrition subscore (0–100) — Nutri-Score-2023-inspired banding.
 *
 * Negative points: energy density, sugars, saturated fat, salt.
 * Positive points: protein, fiber.
 * Beverages use the stricter beverage banding profile (see ./bands.ts).
 * Missing nutrients are treated conservatively (mid-band for negatives,
 * zero benefit for positives); several missing core nutrients → the caller
 * marks the result lowConfidence via `missingCoreCount`.
 */

import type { NutrimentsPer100, ScoreFlag } from './types'
import {
  BEVERAGE_ANCHORS,
  BEVERAGE_PROFILE,
  KJ_PER_KCAL,
  NUTRIENT_FLAG_THRESHOLDS,
  SOLID_ANCHORS,
  SOLID_PROFILE,
  bandPoints,
  subscoreForPoints,
} from './bands'

export interface NutritionAssessment {
  /** 0–100, higher = better. */
  subscore: number
  flags: ScoreFlag[]
  /** How many of the 4 core negatives (energy/sugars/satfat/salt) are null. */
  missingCoreCount: number
}

export function assessNutrition(
  nutriments: NutrimentsPer100,
  beverage: boolean,
): NutritionAssessment {
  const profile = beverage ? BEVERAGE_PROFILE : SOLID_PROFILE
  const anchors = beverage ? BEVERAGE_ANCHORS : SOLID_ANCHORS

  const energyKj =
    nutriments.energyKcal === null ? null : nutriments.energyKcal * KJ_PER_KCAL

  const negativePoints =
    bandPoints(energyKj, profile.energyKj) +
    bandPoints(nutriments.sugars, profile.sugars) +
    bandPoints(nutriments.saturatedFat, profile.saturatedFat) +
    bandPoints(nutriments.salt, profile.salt)

  const positivePoints =
    bandPoints(nutriments.proteins, profile.proteins) +
    bandPoints(nutriments.fiber, profile.fiber)

  const totalPoints = negativePoints - positivePoints
  const subscore = subscoreForPoints(totalPoints, anchors)

  const missingCoreCount = [
    nutriments.energyKcal,
    nutriments.sugars,
    nutriments.saturatedFat,
    nutriments.salt,
  ].filter((v) => v === null).length

  const thresholds = beverage
    ? NUTRIENT_FLAG_THRESHOLDS.beverage
    : NUTRIENT_FLAG_THRESHOLDS.solid

  const flags: ScoreFlag[] = []
  if (nutriments.sugars !== null && nutriments.sugars > thresholds.sugars) {
    flags.push({ tag: 'high-sugar', label: 'High sugar', severity: 'warn' })
  }
  if (
    nutriments.saturatedFat !== null &&
    nutriments.saturatedFat > thresholds.saturatedFat
  ) {
    flags.push({
      tag: 'high-saturated-fat',
      label: 'High saturated fat',
      severity: 'warn',
    })
  }
  if (nutriments.salt !== null && nutriments.salt > thresholds.salt) {
    flags.push({ tag: 'high-salt', label: 'High salt', severity: 'warn' })
  }

  return { subscore, flags, missingCoreCount }
}
