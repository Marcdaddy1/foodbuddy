/**
 * Committed Open Food Facts fixture payloads for normalizer tests.
 *
 * These mirror REAL OFF API v2 responses (trimmed to the fields we request),
 * including the mess: numeric strings, missing nutriments, unrecognized
 * ingredients, and locale-prefixed tags. Kept as .ts (not .json) so tsc
 * needs no resolveJsonModule and payloads stay typed as `unknown` at use.
 */

/** Nutella — rich, well-annotated product (allergens, additives, NOVA 4). */
export const OFF_NUTELLA = {
  code: '3017620422003',
  status: 1,
  status_verbose: 'product found',
  product: {
    code: '3017620422003',
    product_name: 'Nutella',
    brands: 'Ferrero,Nutella',
    categories_tags: [
      'en:breakfasts',
      'en:spreads',
      'en:sweet-spreads',
      'fr:pates-a-tartiner',
      'en:hazelnut-spreads',
      'en:chocolate-spreads',
    ],
    ingredients_text:
      'Sugar, palm oil, HAZELNUTS 13%, skimmed MILK powder 8.7%, fat-reduced cocoa 7.4%, emulsifier: lecithin (SOYA), vanillin.',
    ingredients: [
      { id: 'en:sugar', text: 'Sugar', percent_estimate: 38.35 },
      { id: 'en:palm-oil', text: 'palm oil', percent_estimate: 22.75 },
      { id: 'en:hazelnut', text: 'HAZELNUTS', percent: 13, percent_estimate: 13 },
      { id: 'en:skimmed-milk-powder', text: 'skimmed MILK powder', percent: 8.7 },
      { id: 'en:fat-reduced-cocoa', text: 'fat-reduced cocoa', percent: 7.4 },
      { id: 'en:soya-lecithin', text: 'lecithin', has_sub_ingredients: 'yes' },
      { id: 'en:vanillin', text: 'vanillin' },
    ],
    nutriments: {
      'energy-kcal_100g': 539,
      energy_100g: 2252,
      fat_100g: 30.9,
      'saturated-fat_100g': 10.6,
      carbohydrates_100g: 57.5,
      sugars_100g: 56.3,
      proteins_100g: 6.3,
      salt_100g: 0.107,
      sodium_100g: 0.0428,
    },
    nova_group: 4,
    additives_tags: ['en:e322', 'en:e322i'],
    allergens_tags: ['en:milk', 'en:nuts', 'en:soybeans'],
    traces_tags: [],
    last_modified_t: 1719772800,
  },
} as const

/**
 * Sparse product — empty nutriments, no NOVA, no structured ingredients,
 * but declared traces. Exercises null-nutrient handling + lowConfidence.
 */
export const OFF_SPARSE = {
  code: '4311501043666',
  status: 1,
  status_verbose: 'product found',
  product: {
    code: '4311501043666',
    product_name: 'Bio Apfelmus',
    brands: 'Edeka Bio',
    categories_tags: ['en:plant-based-foods', 'de:apfelmus'],
    ingredients_text: null,
    nutriments: {},
    additives_tags: [],
    allergens_tags: [],
    traces_tags: ['en:milk', 'en:nuts'],
    last_modified_t: 1650000000,
  },
} as const

/**
 * Weird product — numeric strings, unrecognized vernacular ingredients (no
 * taxonomy ids), a "may contain" clause inside ingredients_text, kJ-only
 * energy, and sodium instead of salt. Exercises coercion + conservative
 * "unknown" classification + text-based traces extraction.
 */
export const OFF_WEIRD = {
  code: '6191509900107',
  status: '1',
  status_verbose: 'product found',
  product: {
    code: '6191509900107',
    product_name: '  Harissa du Cap Bon ',
    brands: null,
    categories_tags: ['en:condiments', 'fr:harissa'],
    ingredients_text:
      'Piments rouges, ail, coriandre, carvi, sel. May contain traces of celery and mustard.',
    ingredients: [
      { id: null, text: 'Piments rouges' },
      { id: null, text: 'ail' },
      { text: 'coriandre' },
      { id: 'en:salt', text: 'sel' },
    ],
    nutriments: {
      energy_100g: '377',
      fat_100g: '2.1',
      carbohydrates_100g: '12',
      sugars_100g: 'not-a-number',
      proteins_100g: 4.2,
      sodium_100g: '1.2',
    },
    nova_group: '3',
    additives_tags: [],
    allergens_tags: [],
    traces_tags: [],
    last_modified_t: '1699999999',
  },
} as const

/** OFF "product not found" body (HTTP 404 also returns this shape). */
export const OFF_NOT_FOUND = {
  code: '0000000000000',
  status: 0,
  status_verbose: 'product not found',
} as const
