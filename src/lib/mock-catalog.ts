/**
 * MOCK PRODUCT CATALOG — PLACEHOLDER DATA.
 *
 * Mirrors the 5 seed products in supabase/seed.sql (real EAN barcodes, data
 * simplified from Open Food Facts) so the UI phase can be built and demoed
 * without a backend. The static `score`, category sub-scores, risk classes
 * and ingredient explanations here are hand-written placeholders — the real
 * deterministic scoring engine replaces all of this in Phase 1, and the
 * personal verdict engine lands in Phase 2 (see src/stores/dietary-profile.ts).
 *
 * Nothing in this file may be treated as nutrition or medical truth.
 */

// Canonical RiskClass now lives with the real-data normalizer; re-exported
// here so existing imports keep working.
export type { RiskClass } from './off/types'
import type { RiskClass } from './off/types'

export interface MockIngredient {
  name: string
  riskClass: RiskClass
  /** OFF-style allergen taxonomy tags this ingredient maps to (e.g. 'en:milk'). */
  allergenTags: string[]
  /** Mock cached explanation (Phase 1 serves these from ingredient_explanations). */
  explanation: {
    summary: string
    riskNote: string
    /** Evidence framing line shown in the detail sheet. */
    evidence: string
  }
}

export interface MockNutriments {
  energyKcal100g: number
  fat100g: number
  saturatedFat100g: number
  carbohydrates100g: number
  sugars100g: number
  proteins100g: number
  salt100g: number
}

export type GradeBand = 'A' | 'B' | 'C' | 'D' | 'E'

export interface MockProduct {
  barcode: string
  name: string
  brand: string
  categories: string[]
  ingredients: MockIngredient[]
  nutriments: MockNutriments
  /** NOVA processing group 1 (unprocessed) – 4 (ultra-processed). */
  novaGroup: 1 | 2 | 3 | 4
  /** Declared "contains" allergens (OFF taxonomy tags). */
  allergenTags: string[]
  /** "May contain traces of…" allergens (OFF taxonomy tags). */
  mayContainTags: string[]
  /** PLACEHOLDER 0–100 health score — Phase 1 computes this deterministically. */
  score: number
  /** PLACEHOLDER per-category sub-scores (0–100) shown in the breakdown. */
  categoryScores: {
    nutrition: number
    additives: number
    processing: number
  }
  /** Mock data-freshness stamp for the Open Food Facts attribution line. */
  offLastFetchedAt: string
}

/** Grade band mapping per MASTER.md: A 80+, B 60–79, C 40–59, D 20–39, E <20. */
export function gradeBand(score: number): GradeBand {
  if (score >= 80) return 'A'
  if (score >= 60) return 'B'
  if (score >= 40) return 'C'
  if (score >= 20) return 'D'
  return 'E'
}

export const MOCK_PRODUCTS: MockProduct[] = [
  {
    barcode: '3017620422003',
    name: 'Nutella',
    brand: 'Ferrero',
    categories: ['spreads', 'sweet-spreads', 'hazelnut-spreads'],
    ingredients: [
      {
        name: 'Sugar',
        riskClass: 'benign',
        allergenTags: [],
        explanation: {
          summary: 'Refined sugar adds sweetness and calories with no other nutrients.',
          riskNote: 'At 56g per 100g this product is very high in sugar.',
          evidence: 'Sugar thresholds follow the UK FSA front-of-pack guidance.',
        },
      },
      {
        name: 'Palm oil',
        riskClass: 'controversial',
        allergenTags: [],
        explanation: {
          summary: 'A saturated vegetable fat used for texture and shelf life.',
          riskNote: 'High in saturated fat; environmental sourcing concerns are common.',
          evidence: 'Classification based on Open Food Facts ingredient taxonomy.',
        },
      },
      {
        name: 'Hazelnuts (13%)',
        riskClass: 'allergen',
        allergenTags: ['en:nuts'],
        explanation: {
          summary: 'Whole tree nuts, ground into the spread.',
          riskNote: 'Tree nuts are one of the 14 major allergens — avoid with a nut allergy.',
          evidence: 'Declared allergen on the product label (Open Food Facts).',
        },
      },
      {
        name: 'Skimmed milk powder (8.7%)',
        riskClass: 'allergen',
        allergenTags: ['en:milk'],
        explanation: {
          summary: 'Dried cow’s milk with the fat removed.',
          riskNote: 'Contains milk protein and lactose — a major allergen.',
          evidence: 'Declared allergen on the product label (Open Food Facts).',
        },
      },
      {
        name: 'Fat-reduced cocoa (7.4%)',
        riskClass: 'benign',
        allergenTags: [],
        explanation: {
          summary: 'Cocoa powder with part of the cocoa butter pressed out.',
          riskNote: 'No specific risk flags for most people.',
          evidence: 'Classification based on Open Food Facts ingredient taxonomy.',
        },
      },
      {
        name: 'Soya lecithin (emulsifier)',
        riskClass: 'allergen',
        allergenTags: ['en:soybeans'],
        explanation: {
          summary: 'An emulsifier made from soybeans that keeps fats and water mixed.',
          riskNote:
            'Soy-derived: most people with soy allergy tolerate highly refined lecithin, but check with your clinician.',
          evidence: 'Declared allergen on the product label (Open Food Facts).',
        },
      },
      {
        name: 'Vanillin',
        riskClass: 'additive',
        allergenTags: [],
        explanation: {
          summary: 'A synthetic vanilla flavouring.',
          riskNote: 'Generally recognised as safe at food quantities.',
          evidence: 'Classification based on Open Food Facts ingredient taxonomy.',
        },
      },
    ],
    nutriments: {
      energyKcal100g: 539,
      fat100g: 30.9,
      saturatedFat100g: 10.6,
      carbohydrates100g: 57.5,
      sugars100g: 56.3,
      proteins100g: 6.3,
      salt100g: 0.107,
    },
    novaGroup: 4,
    allergenTags: ['en:milk', 'en:nuts', 'en:soybeans'],
    mayContainTags: [],
    score: 22,
    categoryScores: { nutrition: 12, additives: 45, processing: 15 },
    offLastFetchedAt: '2026-07-01',
  },
  {
    barcode: '5449000000996',
    name: 'Coca-Cola',
    brand: 'Coca-Cola',
    categories: ['beverages', 'carbonated-drinks', 'sodas'],
    ingredients: [
      {
        name: 'Carbonated water',
        riskClass: 'benign',
        allergenTags: [],
        explanation: {
          summary: 'Water with dissolved carbon dioxide for fizz.',
          riskNote: 'No risk flags.',
          evidence: 'Classification based on Open Food Facts ingredient taxonomy.',
        },
      },
      {
        name: 'Sugar',
        riskClass: 'benign',
        allergenTags: [],
        explanation: {
          summary: 'Refined sugar — 10.6g per 100ml here.',
          riskNote: 'A 330ml can carries roughly 35g of sugar.',
          evidence: 'Sugar thresholds follow the UK FSA front-of-pack guidance.',
        },
      },
      {
        name: 'Caramel colour (E150d)',
        riskClass: 'additive',
        allergenTags: [],
        explanation: {
          summary: 'A colouring made by heating sugars with sulphite/ammonia compounds.',
          riskNote: 'Approved additive; some debate about 4-MEI by-products at high doses.',
          evidence: 'Classification based on Open Food Facts additive taxonomy.',
        },
      },
      {
        name: 'Phosphoric acid',
        riskClass: 'additive',
        allergenTags: [],
        explanation: {
          summary: 'An acidity regulator that gives cola its sharp taste.',
          riskNote: 'Approved additive; very high intakes are linked to dental erosion.',
          evidence: 'Classification based on Open Food Facts additive taxonomy.',
        },
      },
      {
        name: 'Natural flavourings (incl. caffeine)',
        riskClass: 'unknown',
        allergenTags: [],
        explanation: {
          summary: 'An undisclosed blend of flavouring compounds plus caffeine.',
          riskNote:
            'The exact composition is not published, so allergen exposure cannot be fully verified.',
          evidence: 'Composition undisclosed by the manufacturer — treated conservatively.',
        },
      },
    ],
    nutriments: {
      energyKcal100g: 42,
      fat100g: 0,
      saturatedFat100g: 0,
      carbohydrates100g: 10.6,
      sugars100g: 10.6,
      proteins100g: 0,
      salt100g: 0,
    },
    novaGroup: 4,
    allergenTags: [],
    mayContainTags: [],
    score: 30,
    categoryScores: { nutrition: 25, additives: 30, processing: 15 },
    offLastFetchedAt: '2026-07-02',
  },
  {
    barcode: '5000157024671',
    name: 'Tomato Ketchup',
    brand: 'Heinz',
    categories: ['condiments', 'sauces', 'ketchup'],
    ingredients: [
      {
        name: 'Tomatoes (148g per 100g)',
        riskClass: 'benign',
        allergenTags: [],
        explanation: {
          summary: 'Concentrated tomatoes — the main ingredient.',
          riskNote: 'No risk flags.',
          evidence: 'Classification based on Open Food Facts ingredient taxonomy.',
        },
      },
      {
        name: 'Spirit vinegar',
        riskClass: 'benign',
        allergenTags: [],
        explanation: {
          summary: 'A clear vinegar used for preservation and tang.',
          riskNote: 'No risk flags.',
          evidence: 'Classification based on Open Food Facts ingredient taxonomy.',
        },
      },
      {
        name: 'Sugar',
        riskClass: 'benign',
        allergenTags: [],
        explanation: {
          summary: 'Added sugar — 22.8g per 100g in this ketchup.',
          riskNote: 'High per 100g, though typical servings are small (~15g).',
          evidence: 'Sugar thresholds follow the UK FSA front-of-pack guidance.',
        },
      },
      {
        name: 'Salt',
        riskClass: 'benign',
        allergenTags: [],
        explanation: {
          summary: 'Added salt — 1.8g per 100g.',
          riskNote: 'High per 100g; watch total daily salt if you eat a lot of it.',
          evidence: 'Salt thresholds follow the UK FSA front-of-pack guidance.',
        },
      },
      {
        name: 'Spice and herb extracts (contain celery)',
        riskClass: 'allergen',
        allergenTags: ['en:celery'],
        explanation: {
          summary: 'Flavouring extracts that include celery.',
          riskNote: 'Celery is one of the 14 major allergens.',
          evidence: 'Declared allergen on the product label (Open Food Facts).',
        },
      },
    ],
    nutriments: {
      energyKcal100g: 102,
      fat100g: 0.1,
      saturatedFat100g: 0,
      carbohydrates100g: 23.2,
      sugars100g: 22.8,
      proteins100g: 1.2,
      salt100g: 1.8,
    },
    novaGroup: 3,
    allergenTags: ['en:celery'],
    mayContainTags: [],
    score: 48,
    categoryScores: { nutrition: 40, additives: 70, processing: 45 },
    offLastFetchedAt: '2026-06-28',
  },
  {
    barcode: '8076800105057',
    name: 'Spaghetti n.5',
    brand: 'Barilla',
    categories: ['pastas', 'durum-wheat-pasta', 'spaghetti'],
    ingredients: [
      {
        name: 'Durum wheat semolina',
        riskClass: 'allergen',
        allergenTags: ['en:gluten'],
        explanation: {
          summary: 'Coarsely ground durum wheat — the whole product.',
          riskNote: 'Contains gluten; unsuitable for coeliac disease or wheat allergy.',
          evidence: 'Declared allergen on the product label (Open Food Facts).',
        },
      },
      {
        name: 'Water',
        riskClass: 'benign',
        allergenTags: [],
        explanation: {
          summary: 'Used to bind the semolina into pasta.',
          riskNote: 'No risk flags.',
          evidence: 'Classification based on Open Food Facts ingredient taxonomy.',
        },
      },
    ],
    nutriments: {
      energyKcal100g: 359,
      fat100g: 2,
      saturatedFat100g: 0.5,
      carbohydrates100g: 70.9,
      sugars100g: 3.5,
      proteins100g: 12.5,
      salt100g: 0.013,
    },
    novaGroup: 1,
    allergenTags: ['en:gluten'],
    mayContainTags: ['en:soybeans'],
    score: 82,
    categoryScores: { nutrition: 75, additives: 100, processing: 95 },
    offLastFetchedAt: '2026-07-03',
  },
  {
    barcode: '7622210449283',
    name: 'Oreo Original',
    brand: 'Mondelez',
    categories: ['snacks', 'biscuits', 'sandwich-biscuits'],
    ingredients: [
      {
        name: 'Wheat flour',
        riskClass: 'allergen',
        allergenTags: ['en:gluten'],
        explanation: {
          summary: 'Milled wheat — the biscuit base.',
          riskNote: 'Contains gluten; unsuitable for coeliac disease or wheat allergy.',
          evidence: 'Declared allergen on the product label (Open Food Facts).',
        },
      },
      {
        name: 'Sugar',
        riskClass: 'benign',
        allergenTags: [],
        explanation: {
          summary: 'Added sugar — 38g per 100g here.',
          riskNote: 'High in sugar per the UK FSA thresholds.',
          evidence: 'Sugar thresholds follow the UK FSA front-of-pack guidance.',
        },
      },
      {
        name: 'Palm oil',
        riskClass: 'controversial',
        allergenTags: [],
        explanation: {
          summary: 'A saturated vegetable fat used for the filling texture.',
          riskNote: 'High in saturated fat; environmental sourcing concerns are common.',
          evidence: 'Classification based on Open Food Facts ingredient taxonomy.',
        },
      },
      {
        name: 'Glucose-fructose syrup',
        riskClass: 'additive',
        allergenTags: [],
        explanation: {
          summary: 'A liquid sweetener made from starch.',
          riskNote: 'A marker of ultra-processing; adds free sugars.',
          evidence: 'Classification based on Open Food Facts ingredient taxonomy.',
        },
      },
      {
        name: 'Soya lecithin (emulsifier)',
        riskClass: 'allergen',
        allergenTags: ['en:soybeans'],
        explanation: {
          summary: 'An emulsifier made from soybeans that keeps fats and water mixed.',
          riskNote:
            'Soy-derived: most people with soy allergy tolerate highly refined lecithin, but check with your clinician.',
          evidence: 'Declared allergen on the product label (Open Food Facts).',
        },
      },
      {
        name: 'Flavouring (vanillin)',
        riskClass: 'additive',
        allergenTags: [],
        explanation: {
          summary: 'A synthetic vanilla flavouring.',
          riskNote: 'Generally recognised as safe at food quantities.',
          evidence: 'Classification based on Open Food Facts ingredient taxonomy.',
        },
      },
    ],
    nutriments: {
      energyKcal100g: 480,
      fat100g: 20,
      saturatedFat100g: 6.1,
      carbohydrates100g: 69,
      sugars100g: 38,
      proteins100g: 5,
      salt100g: 0.9,
    },
    novaGroup: 4,
    allergenTags: ['en:gluten', 'en:soybeans'],
    mayContainTags: ['en:milk'],
    score: 25,
    categoryScores: { nutrition: 18, additives: 40, processing: 15 },
    offLastFetchedAt: '2026-06-30',
  },
]

export function findProduct(barcode: string): MockProduct | undefined {
  return MOCK_PRODUCTS.find((p) => p.barcode === barcode)
}

/* ---------------------------------------------------------------------------
 * Nutrient traffic lights (UK FSA front-of-pack thresholds, per 100g, food).
 * PLACEHOLDER: Phase 1 moves this into the scoring engine with per-drink
 * thresholds and portion awareness.
 * ------------------------------------------------------------------------- */

export type TrafficLight = 'low' | 'medium' | 'high'

export interface NutrientRow {
  key: keyof MockNutriments
  label: string
  unit: string
  value: number
  light: TrafficLight | null
}

function light(value: number, low: number, high: number): TrafficLight {
  if (value <= low) return 'low'
  if (value > high) return 'high'
  return 'medium'
}

export function nutrientRows(n: MockNutriments): NutrientRow[] {
  return [
    { key: 'energyKcal100g', label: 'Energy', unit: 'kcal', value: n.energyKcal100g, light: null },
    { key: 'fat100g', label: 'Fat', unit: 'g', value: n.fat100g, light: light(n.fat100g, 3, 17.5) },
    {
      key: 'saturatedFat100g',
      label: 'Saturates',
      unit: 'g',
      value: n.saturatedFat100g,
      light: light(n.saturatedFat100g, 1.5, 5),
    },
    {
      key: 'carbohydrates100g',
      label: 'Carbohydrates',
      unit: 'g',
      value: n.carbohydrates100g,
      light: null,
    },
    { key: 'sugars100g', label: 'Sugars', unit: 'g', value: n.sugars100g, light: light(n.sugars100g, 5, 22.5) },
    { key: 'proteins100g', label: 'Protein', unit: 'g', value: n.proteins100g, light: null },
    { key: 'salt100g', label: 'Salt', unit: 'g', value: n.salt100g, light: light(n.salt100g, 0.3, 1.5) },
  ]
}

/* ---------------------------------------------------------------------------
 * Mock scan history — placeholder until scans persist to Supabase (Phase 1).
 * Timestamps are computed relative to "now" so the History grouping demos well.
 * ------------------------------------------------------------------------- */

export interface MockScan {
  barcode: string
  scannedAt: Date
}

function daysAgo(days: number, hour: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(hour, 24, 0, 0)
  return d
}

export const MOCK_SCANS: MockScan[] = [
  { barcode: '3017620422003', scannedAt: daysAgo(0, 9) },
  { barcode: '8076800105057', scannedAt: daysAgo(0, 8) },
  { barcode: '5449000000996', scannedAt: daysAgo(1, 18) },
  { barcode: '7622210449283', scannedAt: daysAgo(1, 12) },
  { barcode: '5000157024671', scannedAt: daysAgo(3, 17) },
]
