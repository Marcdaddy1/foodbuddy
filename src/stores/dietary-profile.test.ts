import { describe, expect, it } from 'vitest'
import { deriveVerdict, useDietaryProfileStore, type VerdictInput } from './dietary-profile'
import { findProduct, type MockProduct } from '../lib/mock-catalog'

const EMPTY_PROFILE: VerdictInput = {
  allergies: [],
  intolerances: [],
  dietPatterns: [],
  customAvoid: [],
}

function profile(overrides: Partial<VerdictInput>): VerdictInput {
  return { ...EMPTY_PROFILE, ...overrides }
}

function product(barcode: string): MockProduct {
  const found = findProduct(barcode)
  if (!found) throw new Error(`missing mock product ${barcode}`)
  return found
}

const NUTELLA = '3017620422003'
const COCA_COLA = '5449000000996'
const KETCHUP = '5000157024671'
const BARILLA = '8076800105057'
const OREO = '7622210449283'

describe('deriveVerdict', () => {
  it('returns Safe with an explanatory rule when the profile is empty', () => {
    const result = deriveVerdict(product(NUTELLA), EMPTY_PROFILE)
    expect(result.verdict).toBe('safe')
    expect(result.rule).toMatch(/no conflicts/i)
  })

  it('returns Avoid with the triggering rule when a declared allergen is present', () => {
    const result = deriveVerdict(
      product(NUTELLA),
      profile({ allergies: [{ tag: 'en:milk', severity: 'severe' }] }),
    )
    expect(result.verdict).toBe('avoid')
    expect(result.rule).toBe('Contains milk — your allergy')
  })

  it('returns Caution when the product only "may contain" a declared allergen', () => {
    // Oreo declares "may contain milk" but does not contain milk.
    const result = deriveVerdict(
      product(OREO),
      profile({ allergies: [{ tag: 'en:milk', severity: 'moderate' }] }),
    )
    expect(result.verdict).toBe('caution')
    expect(result.rule).toMatch(/may contain traces of milk/i)
  })

  it('fails conservative: unknown ingredient + declared allergy => Caution, never Safe', () => {
    // Coca-Cola has an "unknown" natural-flavourings ingredient and no
    // declared allergens — an egg allergy must still downgrade it to Caution.
    const result = deriveVerdict(
      product(COCA_COLA),
      profile({ allergies: [{ tag: 'en:eggs', severity: 'mild' }] }),
    )
    expect(result.verdict).toBe('caution')
    expect(result.rule).toMatch(/can't be fully verified/i)
  })

  it('does not flag unknown ingredients when no allergies are declared', () => {
    const result = deriveVerdict(product(COCA_COLA), EMPTY_PROFILE)
    expect(result.verdict).toBe('safe')
  })

  it('a hard "contains" hit outranks a may-contain hit', () => {
    // Barilla contains gluten and may contain soy.
    const result = deriveVerdict(
      product(BARILLA),
      profile({
        allergies: [
          { tag: 'en:soybeans', severity: 'severe' },
          { tag: 'en:gluten', severity: 'mild' },
        ],
      }),
    )
    expect(result.verdict).toBe('avoid')
    expect(result.rule).toBe('Contains gluten (wheat) — your allergy')
  })

  it('returns Avoid for a custom avoid-list match (case-insensitive)', () => {
    const result = deriveVerdict(product(NUTELLA), profile({ customAvoid: ['Palm Oil'] }))
    expect(result.verdict).toBe('avoid')
    expect(result.rule).toBe('Contains Palm Oil — on your avoid list')
  })

  it('returns Caution for an intolerance tag match', () => {
    const result = deriveVerdict(product(NUTELLA), profile({ intolerances: ['lactose'] }))
    expect(result.verdict).toBe('caution')
    expect(result.rule).toMatch(/lactose intolerance/i)
  })

  it('returns Caution for a diet-pattern conflict', () => {
    const result = deriveVerdict(product(NUTELLA), profile({ dietPatterns: ['vegan'] }))
    expect(result.verdict).toBe('caution')
    expect(result.rule).toMatch(/not vegan/i)
  })

  it('celery allergy flags Heinz ketchup via the ingredient-level tag', () => {
    const result = deriveVerdict(
      product(KETCHUP),
      profile({ allergies: [{ tag: 'en:celery', severity: 'moderate' }] }),
    )
    expect(result.verdict).toBe('avoid')
    expect(result.rule).toBe('Contains celery — your allergy')
  })
})

describe('deriveVerdict with NormalizedProduct-shaped input (real OFF data)', () => {
  /** Mimics src/lib/off NormalizedProduct: tracesTags instead of mayContainTags. */
  function normalizedProduct(overrides: {
    ingredients?: { name: string; riskClass: 'allergen' | 'additive' | 'controversial' | 'benign' | 'unknown'; allergenTags: string[] }[]
    allergenTags?: string[]
    tracesTags?: string[]
  }) {
    return {
      name: 'Test product',
      ingredients: overrides.ingredients ?? [],
      allergenTags: overrides.allergenTags ?? [],
      tracesTags: overrides.tracesTags ?? [],
    }
  }

  it('OFF tracesTags with a declared allergy => Caution', () => {
    const result = deriveVerdict(
      normalizedProduct({ tracesTags: ['en:milk'] }),
      profile({ allergies: [{ tag: 'en:milk', severity: 'severe' }] }),
    )
    expect(result.verdict).toBe('caution')
    expect(result.rule).toMatch(/may contain traces of milk/i)
  })

  it('product-level allergen tag alone (no ingredient rows) => Avoid with rule text', () => {
    // OFF often declares allergens_tags even when the ingredient list is missing.
    const result = deriveVerdict(
      normalizedProduct({ allergenTags: ['en:nuts'] }),
      profile({ allergies: [{ tag: 'en:nuts', severity: 'moderate' }] }),
    )
    expect(result.verdict).toBe('avoid')
    expect(result.rule).toBe('Contains tree nuts — your allergy')
  })

  it('unknown (unparseable) ingredient + declared allergy => Caution, never Safe', () => {
    const result = deriveVerdict(
      normalizedProduct({
        ingredients: [{ name: 'Piments rouges', riskClass: 'unknown', allergenTags: [] }],
      }),
      profile({ allergies: [{ tag: 'en:eggs', severity: 'mild' }] }),
    )
    expect(result.verdict).toBe('caution')
    expect(result.rule).toMatch(/can't be fully verified/i)
  })

  it('unknown ingredient without any declared allergy stays Safe', () => {
    const result = deriveVerdict(
      normalizedProduct({
        ingredients: [{ name: 'Piments rouges', riskClass: 'unknown', allergenTags: [] }],
      }),
      EMPTY_PROFILE,
    )
    expect(result.verdict).toBe('safe')
  })

  it('a "contains" allergen outranks traces of another declared allergen', () => {
    const result = deriveVerdict(
      normalizedProduct({ allergenTags: ['en:gluten'], tracesTags: ['en:soybeans'] }),
      profile({
        allergies: [
          { tag: 'en:soybeans', severity: 'severe' },
          { tag: 'en:gluten', severity: 'mild' },
        ],
      }),
    )
    expect(result.verdict).toBe('avoid')
    expect(result.rule).toBe('Contains gluten (wheat) — your allergy')
  })

  it('intolerances match ingredient-level allergen tags from normalized data', () => {
    const result = deriveVerdict(
      normalizedProduct({
        ingredients: [{ name: 'skimmed milk powder', riskClass: 'allergen', allergenTags: ['en:milk'] }],
      }),
      profile({ intolerances: ['lactose'] }),
    )
    expect(result.verdict).toBe('caution')
    expect(result.rule).toMatch(/lactose intolerance/i)
  })
})

describe('useDietaryProfileStore', () => {
  it('toggles allergies with a default moderate severity and updates severity', () => {
    const store = useDietaryProfileStore
    store.setState({ allergies: [], intolerances: [], dietPatterns: [], customAvoid: [] })

    store.getState().toggleAllergy('en:milk')
    expect(store.getState().allergies).toEqual([{ tag: 'en:milk', severity: 'moderate' }])

    store.getState().setAllergySeverity('en:milk', 'severe')
    expect(store.getState().allergies[0]?.severity).toBe('severe')

    store.getState().toggleAllergy('en:milk')
    expect(store.getState().allergies).toEqual([])
  })

  it('dedupes custom avoid terms case-insensitively', () => {
    const store = useDietaryProfileStore
    store.setState({ allergies: [], intolerances: [], dietPatterns: [], customAvoid: [] })

    store.getState().addCustomAvoid('palm oil')
    store.getState().addCustomAvoid('Palm Oil')
    store.getState().addCustomAvoid('  ')
    expect(store.getState().customAvoid).toEqual(['palm oil'])

    store.getState().removeCustomAvoid('palm oil')
    expect(store.getState().customAvoid).toEqual([])
  })
})
