/**
 * Normalized product model — the app-facing shape for real product data,
 * whether it came from the Open Food Facts API or the Supabase `products`
 * cache. Both sources normalize into this ONE type so scoring and verdicts
 * are deterministic regardless of the resolution path.
 */
import type { NutrimentsPer100 } from '../scoring'

/** Coarse ingredient risk classification used for the UI risk chips. */
export type RiskClass =
  | 'allergen'
  | 'additive'
  | 'controversial'
  | 'benign'
  | 'unknown'

export interface NormalizedIngredient {
  /** Display name as printed on the label (best-effort). */
  name: string
  /** OFF taxonomy id (e.g. "en:soya-lecithin"), null when OFF didn't recognize it. */
  offId: string | null
  riskClass: RiskClass
  /** Allergen taxonomy tags this ingredient maps to (e.g. ["en:milk"]). */
  allergenTags: string[]
}

export type ProductSource = 'off' | 'supabase-cache'

export interface NormalizedProduct {
  barcode: string
  name: string
  brand: string
  /** Category slugs with the locale prefix stripped (e.g. "carbonated-drinks"). */
  categories: string[]
  /** Raw ingredients text from the label, null when OFF has none. */
  ingredientsRaw: string | null
  /** Best-effort structured ingredient list with allergen/risk mapping. */
  ingredients: NormalizedIngredient[]
  /** Per-100g/ml nutrient values matching the scoring contract. */
  nutriments: NutrimentsPer100
  novaGroup: 1 | 2 | 3 | 4 | null
  /** OFF additive tags, e.g. ["en:e150d"]. */
  additiveTags: string[]
  /** Declared "contains" allergen tags, e.g. ["en:milk"]. */
  allergenTags: string[]
  /** "May contain traces of…" allergen tags. */
  tracesTags: string[]
  /** ISO timestamp of when this data was fetched from OFF (or cached). */
  fetchedAt: string
  source: ProductSource
  /**
   * True when this is a stale Supabase cache row served because Open Food
   * Facts was unreachable — the UI shows a "showing cached data" banner.
   */
  stale: boolean
  /** Supabase products.id when the row is known (cache hit), else null. */
  supabaseProductId: string | null
}
