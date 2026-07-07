/**
 * Maps a raw Open Food Facts product (as returned by the OFF v2 search/
 * product API) to the engine's ScoringInput. Shared by the golden-file
 * generator (scripts/generate-golden.ts) and the golden test so both always
 * agree on the mapping. Pure and deterministic — safe for runtime use when
 * the scan flow gets wired up.
 */

import type { ScoringInput } from './types'

export interface OffProduct {
  code?: string
  product_name?: string
  brands?: string
  nutriments?: Record<string, unknown>
  nova_group?: unknown
  additives_tags?: unknown
  categories_tags?: unknown
}

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string')
    : []
}

function toNovaGroup(value: unknown): ScoringInput['novaGroup'] {
  return value === 1 || value === 2 || value === 3 || value === 4 ? value : null
}

export function offProductToScoringInput(product: OffProduct): ScoringInput {
  const n = product.nutriments ?? {}
  return {
    nutriments: {
      energyKcal: toNumber(n['energy-kcal_100g']),
      fat: toNumber(n['fat_100g']),
      saturatedFat: toNumber(n['saturated-fat_100g']),
      carbohydrates: toNumber(n['carbohydrates_100g']),
      sugars: toNumber(n['sugars_100g']),
      proteins: toNumber(n['proteins_100g']),
      salt: toNumber(n['salt_100g']),
      fiber: toNumber(n['fiber_100g']),
    },
    novaGroup: toNovaGroup(product.nova_group),
    additiveTags: toStringArray(product.additives_tags),
    categories: toStringArray(product.categories_tags),
  }
}
