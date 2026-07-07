/**
 * Open Food Facts normalizer.
 *
 * Turns messy OFF API payloads (and cached Supabase `products` rows) into the
 * app's NormalizedProduct shape. Everything here is pure and deterministic —
 * no network, no clocks — so the same payload always normalizes identically
 * (the scoring engine depends on that).
 */
import { z } from 'zod'
import type { NutrimentsPer100, ScoringInput } from '../scoring'
import type { Tables } from '../database.types'
import type { NormalizedIngredient, NormalizedProduct, RiskClass } from './types'

/* ---------------------------------------------------------------------------
 * Zod schemas — deliberately loose: OFF fields drift, numbers arrive as
 * strings, and half the fields are missing on sparse products. We validate
 * the envelope strictly (so garbage is a parse error, not a crash later) and
 * coerce field-by-field.
 * ------------------------------------------------------------------------- */

/** OFF returns numbers, numeric strings, or garbage. -> number | null */
const looseNumber = z
  .union([z.number(), z.string()])
  .optional()
  .nullable()
  .transform((v) => {
    if (v === null || v === undefined) return null
    const n = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(n) ? n : null
  })

const looseString = z
  .union([z.string(), z.number()])
  .optional()
  .nullable()
  .transform((v) => (v === null || v === undefined ? null : String(v).trim() || null))

const tagArray = z
  .array(z.unknown())
  .optional()
  .nullable()
  .transform((arr) =>
    (arr ?? []).filter((t): t is string => typeof t === 'string' && t.length > 0),
  )

const offIngredientSchema = z
  .object({
    id: looseString,
    text: looseString,
  })
  .loose()

export const offProductSchema = z
  .object({
    code: looseString,
    product_name: looseString,
    brands: looseString,
    categories_tags: tagArray,
    ingredients_text: looseString,
    ingredients: z.array(offIngredientSchema).optional().nullable(),
    nutriments: z.record(z.string(), z.unknown()).optional().nullable(),
    nova_group: looseNumber,
    additives_tags: tagArray,
    allergens_tags: tagArray,
    traces_tags: tagArray,
    last_modified_t: looseNumber,
  })
  .loose()

export const offResponseSchema = z
  .object({
    status: z.union([z.number(), z.string()]).optional().nullable(),
    status_verbose: looseString,
    code: looseString,
    product: offProductSchema.optional().nullable(),
  })
  .loose()

export type OffProduct = z.infer<typeof offProductSchema>
export type OffResponse = z.infer<typeof offResponseSchema>

/* ---------------------------------------------------------------------------
 * Nutriments
 * ------------------------------------------------------------------------- */

function num(obj: Record<string, unknown>, key: string): number | null {
  const v = obj[key]
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? n : null
}

/**
 * Map an OFF `nutriments` object (per-100g keys) to the scoring contract.
 * Fallbacks: kcal from kJ (`energy_100g`), salt from sodium (x2.5).
 * Keys starting with "_" are reserved app metadata (see cache-product) and ignored.
 */
export function nutrimentsFromOff(raw: unknown): NutrimentsPer100 {
  const obj: Record<string, unknown> =
    raw !== null && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}

  let energyKcal = num(obj, 'energy-kcal_100g')
  if (energyKcal === null) {
    const kj = num(obj, 'energy_100g') ?? num(obj, 'energy-kj_100g')
    if (kj !== null) energyKcal = Math.round((kj / 4.184) * 10) / 10
  }

  let salt = num(obj, 'salt_100g')
  if (salt === null) {
    const sodium = num(obj, 'sodium_100g')
    if (sodium !== null) salt = Math.round(sodium * 2.5 * 1000) / 1000
  }

  return {
    energyKcal,
    fat: num(obj, 'fat_100g'),
    saturatedFat: num(obj, 'saturated-fat_100g'),
    carbohydrates: num(obj, 'carbohydrates_100g'),
    sugars: num(obj, 'sugars_100g'),
    proteins: num(obj, 'proteins_100g'),
    salt,
    fiber: num(obj, 'fiber_100g'),
  }
}

/* ---------------------------------------------------------------------------
 * Ingredient classification (best-effort, conservative)
 * ------------------------------------------------------------------------- */

/**
 * Keyword → allergen-tag map (EU 14 major allergens, OFF taxonomy tags).
 * Order matters: "peanut" must match before the generic nut keywords.
 */
const ALLERGEN_KEYWORDS: ReadonlyArray<readonly [RegExp, string]> = [
  [/peanut|arachide|groundnut/i, 'en:peanuts'],
  [/hazelnut|almond|walnut|cashew|pistachio|pecan|macadamia|brazil.nut|tree.nut|\bnuss|noisette|\bnuts?\b/i, 'en:nuts'],
  [/milk|lactose|whey|casein|butter|cream\b|yogurt|yoghurt|cheese|milch|lait/i, 'en:milk'],
  [/wheat|gluten|barley|rye\b|spelt|semolina|kamut|malt\b|weizen|bl[eé]\b/i, 'en:gluten'],
  [/\bsoy\b|soya|soja|soybean|edamame|tofu/i, 'en:soybeans'],
  [/\begg|albumin|œuf|\bei\b/i, 'en:eggs'],
  [/crustacean|shrimp|prawn|crab\b|lobster|crayfish/i, 'en:crustaceans'],
  [/mollus|mussel|oyster|squid|clam\b|scallop|snail/i, 'en:molluscs'],
  [/\bfish|anchovy|tuna|salmon|cod\b|sardine/i, 'en:fish'],
  [/celery|celeriac|c[eé]leri/i, 'en:celery'],
  [/mustard|moutarde|senf/i, 'en:mustard'],
  [/sesame|tahini/i, 'en:sesame-seeds'],
  [/sulphite|sulfite|sulphur dioxide|sulfur dioxide|\be22[0-8]\b/i, 'en:sulphur-dioxide-and-sulphites'],
  [/lupin/i, 'en:lupin'],
]

/** E-number or common additive-role words. */
const ADDITIVE_RE =
  /\be\d{3}[a-z]?\b|emulsifier|stabili[sz]er|preservative|colou?r\b|colou?ring|acidity regulator|antioxidant|thickener|sweetener|raising agent|anti-caking|humectant|vanillin|aspartame|acesulfame|sucralose|nitrite|nitrate|phosphoric acid|caramel colou?r|glucose-fructose|high.fructose/i

/** Ingredients that hide their composition — treated conservatively. */
const UNDISCLOSED_RE = /flavou?r|aroma|arome|spice extract|natural extract/i

const CONTROVERSIAL_RE = /palm oil|palm fat|huile de palme|hydrogenated|shortening/i

/**
 * Clearly benign staples — lets text-parsed ingredients (no OFF taxonomy id,
 * e.g. cached rows) avoid a false "unknown". Deliberately short: anything not
 * on it stays unknown (conservative).
 */
const BENIGN_RE =
  /^(sugar|cane sugar|water|carbonated water|salt|sea salt|cocoa|fat-reduced cocoa|cocoa powder|tomato(es)?( (paste|puree|concentrate))?|spirit vinegar|vinegar|garlic|onion|rice|potato(es)?|olive oil|sunflower oil|rapeseed oil|yeast|black pepper|paprika|lemon juice( concentrate)?|apple|banana|strawberr(y|ies))\b/i

function matchAllergenTags(text: string): string[] {
  const tags: string[] = []
  for (const [re, tag] of ALLERGEN_KEYWORDS) {
    if (re.test(text) && !tags.includes(tag)) tags.push(tag)
  }
  return tags
}

/**
 * Classify one ingredient. Conservative default: if OFF did NOT recognize the
 * ingredient (no taxonomy id) and no rule matches, it is "unknown" — which,
 * combined with a declared allergy, downgrades the verdict to Caution
 * (CLAUDE.md hard rule #2). OFF-recognized ingredients default to benign.
 */
export function classifyIngredient(
  name: string,
  offId: string | null,
): { riskClass: RiskClass; allergenTags: string[] } {
  const haystack = `${offId ?? ''} ${name}`
  const allergenTags = matchAllergenTags(haystack)
  if (allergenTags.length > 0) return { riskClass: 'allergen', allergenTags }
  if (UNDISCLOSED_RE.test(haystack)) return { riskClass: 'unknown', allergenTags: [] }
  if (ADDITIVE_RE.test(haystack)) return { riskClass: 'additive', allergenTags: [] }
  if (CONTROVERSIAL_RE.test(haystack)) return { riskClass: 'controversial', allergenTags: [] }
  if (BENIGN_RE.test(name.trim())) return { riskClass: 'benign', allergenTags: [] }
  return { riskClass: offId ? 'benign' : 'unknown', allergenTags: [] }
}

/** Split a label ingredients string into rough ingredient names. */
export function splitIngredientsText(text: string): string[] {
  return text
    .replace(/\bmay contain\b.*$/i, '') // traces are handled separately
    .split(/[,;]|\s+and\s+/i)
    .map((part) =>
      part
        .replace(/^\s*(emulsifiers?|stabili[sz]ers?|preservatives?|colou?rs?|acidity regulators?|antioxidants?|thickeners?|raising agents?|sweeteners?)\s*:\s*/i, '$1: ')
        .replace(/[.\s]+$/g, '')
        .trim(),
    )
    .filter((part) => part.length > 1)
}

function ingredientsFromOff(product: OffProduct): NormalizedIngredient[] {
  const structured = (product.ingredients ?? [])
    .map((ing): NormalizedIngredient | null => {
      const name = ing.text ?? ing.id?.replace(/^[a-z]{2,3}:/, '').replace(/-/g, ' ') ?? null
      if (!name) return null
      const offId = ing.id ?? null
      return { name, offId, ...classifyIngredient(name, offId) }
    })
    .filter((ing): ing is NormalizedIngredient => ing !== null)

  if (structured.length > 0) return structured

  // Fallback: best-effort parse of the raw label text.
  if (product.ingredients_text) {
    return splitIngredientsText(product.ingredients_text).map((name) => ({
      name,
      offId: null,
      ...classifyIngredient(name, null),
    }))
  }
  return []
}

/** Best-effort "may contain …" extraction from raw label text. */
export function tracesFromText(text: string | null): string[] {
  if (!text) return []
  const match = /may contain(?:\s+traces?\s+of)?\s*:?\s*([^.;]*)/i.exec(text)
  if (!match?.[1]) return []
  return matchAllergenTags(match[1])
}

/** Best-effort E-number extraction (used for cached rows without additive tags). */
export function additiveTagsFromText(text: string | null): string[] {
  if (!text) return []
  const tags = new Set<string>()
  for (const m of text.matchAll(/\be(\d{3}[a-z]?)\b/gi)) {
    tags.add(`en:e${m[1].toLowerCase()}`)
  }
  return [...tags]
}

/* ---------------------------------------------------------------------------
 * Shared helpers
 * ------------------------------------------------------------------------- */

/** Strip the locale prefix from taxonomy tags ("en:carbonated-drinks" → "carbonated-drinks"). */
export function stripLocale(tag: string): string {
  return tag.replace(/^[a-z]{2,3}:/, '')
}

function normalizeNova(value: number | null): 1 | 2 | 3 | 4 | null {
  return value === 1 || value === 2 || value === 3 || value === 4 ? value : null
}

const ALLERGEN_TAG_RE = /^[a-z]{2,3}:/

function cleanTagList(tags: string[]): string[] {
  return [...new Set(tags.filter((t) => ALLERGEN_TAG_RE.test(t)))]
}

/* ---------------------------------------------------------------------------
 * OFF payload → NormalizedProduct
 * ------------------------------------------------------------------------- */

/**
 * Normalize a parsed OFF product. `fetchedAt` is injected by the caller so
 * this function stays clock-free (deterministic, testable).
 */
export function normalizeOffProduct(
  barcode: string,
  product: OffProduct,
  fetchedAt: string,
): NormalizedProduct {
  const name = product.product_name ?? product.brands ?? 'Unknown product'
  const brand = product.brands?.split(',')[0]?.trim() ?? ''
  const ingredientsRaw = product.ingredients_text ?? null

  return {
    barcode: product.code ?? barcode,
    name,
    brand,
    categories: product.categories_tags.map(stripLocale),
    ingredientsRaw,
    ingredients: ingredientsFromOff(product),
    nutriments: nutrimentsFromOff(product.nutriments ?? {}),
    novaGroup: normalizeNova(product.nova_group),
    additiveTags: cleanTagList(product.additives_tags),
    allergenTags: cleanTagList(product.allergens_tags),
    tracesTags: cleanTagList(
      product.traces_tags.length > 0 ? product.traces_tags : tracesFromText(ingredientsRaw),
    ),
    fetchedAt,
    source: 'off',
    stale: false,
    supabaseProductId: null,
  }
}

/* ---------------------------------------------------------------------------
 * Supabase products row → NormalizedProduct
 * ------------------------------------------------------------------------- */

export type ProductRow = Tables<'products'>

/**
 * Map a cached Supabase `products` row into the same NormalizedProduct shape.
 *
 * The products table has no additive/traces columns, so the cache-product
 * edge function stashes them inside the nutriments jsonb under reserved
 * "_additives_tags" / "_traces_tags" keys. Rows written before that (e.g. the
 * seed rows) fall back to best-effort extraction from ingredients_raw.
 */
export function normalizedFromProductRow(row: ProductRow, stale: boolean): NormalizedProduct {
  const nutrimentsObj: Record<string, unknown> =
    row.nutriments !== null && typeof row.nutriments === 'object' && !Array.isArray(row.nutriments)
      ? (row.nutriments as Record<string, unknown>)
      : {}

  const stashedAdditives = Array.isArray(nutrimentsObj['_additives_tags'])
    ? (nutrimentsObj['_additives_tags'] as unknown[]).filter((t): t is string => typeof t === 'string')
    : null
  const stashedTraces = Array.isArray(nutrimentsObj['_traces_tags'])
    ? (nutrimentsObj['_traces_tags'] as unknown[]).filter((t): t is string => typeof t === 'string')
    : null

  const ingredients: NormalizedIngredient[] = row.ingredients_raw
    ? splitIngredientsText(row.ingredients_raw).map((name) => ({
        name,
        offId: null,
        ...classifyIngredient(name, null),
      }))
    : []

  return {
    barcode: row.barcode,
    name: row.name ?? 'Unknown product',
    brand: row.brand ?? '',
    categories: row.categories.map(stripLocale),
    ingredientsRaw: row.ingredients_raw,
    ingredients,
    nutriments: nutrimentsFromOff(nutrimentsObj),
    novaGroup: normalizeNova(row.nova_group),
    additiveTags: cleanTagList(stashedAdditives ?? additiveTagsFromText(row.ingredients_raw)),
    allergenTags: cleanTagList(row.allergen_tags),
    tracesTags: cleanTagList(stashedTraces ?? tracesFromText(row.ingredients_raw)),
    fetchedAt: row.off_last_fetched_at ?? row.updated_at,
    source: 'supabase-cache',
    stale,
    supabaseProductId: row.id,
  }
}

/* ---------------------------------------------------------------------------
 * NormalizedProduct → scoring input (frozen contract)
 * ------------------------------------------------------------------------- */

export function normalizedToScoringInput(product: NormalizedProduct): ScoringInput {
  return {
    nutriments: product.nutriments,
    novaGroup: product.novaGroup,
    additiveTags: product.additiveTags,
    categories: product.categories,
  }
}
