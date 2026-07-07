/**
 * Beverage detection from OFF category tags.
 *
 * Uses EXACT tag matching (after stripping the language prefix and
 * lowercasing) — never substring matching, because OFF tags plenty of solid
 * foods with "…-foods-and-beverages" umbrella categories
 * (e.g. "en:plant-based-foods-and-beverages" is applied to pasta and bread).
 */

/** Normalized OFF category slugs treated as beverages (per-100 ml banding). */
const BEVERAGE_CATEGORY_TAGS: ReadonlySet<string> = new Set([
  'beverages',
  'beverages-and-beverages-preparations',
  'non-alcoholic-beverages',
  'sweetened-beverages',
  'unsweetened-beverages',
  'artificially-sweetened-beverages',
  'sodas',
  'colas',
  'lemonades',
  'soft-drinks',
  'carbonated-drinks',
  'energy-drinks',
  'sports-drinks',
  'iced-teas',
  'juices',
  'fruit-juices',
  'juices-and-nectars',
  'nectars',
  'fruit-based-beverages',
  'orange-based-beverages',
  'vegetable-based-beverages',
  'plant-based-beverages',
  'almond-based-drinks',
  'nut-based-drinks',
  'plant-based-milk-alternatives',
  'dairy-drinks',
  'milks',
  'flavoured-milks',
  'drinkable-yogurts',
  'waters',
  'mineral-waters',
  'natural-mineral-waters',
  'spring-waters',
  'table-waters',
  'flavoured-waters',
  'carbonated-waters',
  'carbonated-mineral-waters',
  'syrups',
])

/** "en:Carbonated-Drinks" → "carbonated-drinks"; "beverages" → "beverages". */
export function normalizeCategoryTag(tag: string): string {
  const lower = tag.toLowerCase().trim()
  const colon = lower.lastIndexOf(':')
  return colon === -1 ? lower : lower.slice(colon + 1)
}

export function isBeverage(categories: readonly string[]): boolean {
  return categories.some((tag) =>
    BEVERAGE_CATEGORY_TAGS.has(normalizeCategoryTag(tag)),
  )
}
