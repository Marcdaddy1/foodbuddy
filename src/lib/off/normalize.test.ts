import { describe, expect, it } from 'vitest'
import {
  additiveTagsFromText,
  classifyIngredient,
  normalizedFromProductRow,
  normalizedToScoringInput,
  normalizeOffProduct,
  nutrimentsFromOff,
  offResponseSchema,
  tracesFromText,
  type ProductRow,
} from './index'
import { OFF_NUTELLA, OFF_SPARSE, OFF_WEIRD } from './__fixtures__/off-fixtures'

const FETCHED_AT = '2026-07-07T10:00:00.000Z'

function parseFixture(fixture: unknown) {
  const parsed = offResponseSchema.safeParse(fixture)
  if (!parsed.success || !parsed.data.product) {
    throw new Error('fixture failed to parse')
  }
  return parsed.data.product
}

describe('normalizeOffProduct — rich payload (Nutella)', () => {
  const product = normalizeOffProduct('3017620422003', parseFixture(OFF_NUTELLA), FETCHED_AT)

  it('maps identity, categories, and freshness', () => {
    expect(product.barcode).toBe('3017620422003')
    expect(product.name).toBe('Nutella')
    expect(product.brand).toBe('Ferrero') // first of "Ferrero,Nutella"
    expect(product.categories).toContain('hazelnut-spreads')
    expect(product.categories).toContain('pates-a-tartiner') // fr: prefix stripped
    expect(product.fetchedAt).toBe(FETCHED_AT)
    expect(product.source).toBe('off')
    expect(product.stale).toBe(false)
  })

  it('maps nutriments to the scoring contract', () => {
    expect(product.nutriments).toEqual({
      energyKcal: 539,
      fat: 30.9,
      saturatedFat: 10.6,
      carbohydrates: 57.5,
      sugars: 56.3,
      proteins: 6.3,
      salt: 0.107,
      fiber: null,
    })
  })

  it('maps NOVA, additives, and allergens', () => {
    expect(product.novaGroup).toBe(4)
    expect(product.additiveTags).toEqual(['en:e322', 'en:e322i'])
    expect(product.allergenTags).toEqual(['en:milk', 'en:nuts', 'en:soybeans'])
    expect(product.tracesTags).toEqual([])
  })

  it('classifies ingredients with allergen mapping', () => {
    const byName = new Map(product.ingredients.map((i) => [i.name, i]))
    expect(byName.get('HAZELNUTS')?.riskClass).toBe('allergen')
    expect(byName.get('HAZELNUTS')?.allergenTags).toContain('en:nuts')
    expect(byName.get('skimmed MILK powder')?.allergenTags).toContain('en:milk')
    expect(byName.get('lecithin')?.allergenTags).toContain('en:soybeans') // via en:soya-lecithin id
    expect(byName.get('palm oil')?.riskClass).toBe('controversial')
    expect(byName.get('Sugar')?.riskClass).toBe('benign')
  })

  it('feeds the frozen scoring contract shape', () => {
    const input = normalizedToScoringInput(product)
    expect(input.novaGroup).toBe(4)
    expect(input.additiveTags).toEqual(['en:e322', 'en:e322i'])
    expect(input.nutriments.sugars).toBe(56.3)
    expect(input.categories).toContain('sweet-spreads')
  })
})

describe('normalizeOffProduct — sparse payload (missing nutriments)', () => {
  const product = normalizeOffProduct('4311501043666', parseFixture(OFF_SPARSE), FETCHED_AT)

  it('returns all-null nutriments instead of crashing or inventing zeros', () => {
    expect(product.nutriments).toEqual({
      energyKcal: null,
      fat: null,
      saturatedFat: null,
      carbohydrates: null,
      sugars: null,
      proteins: null,
      salt: null,
      fiber: null,
    })
  })

  it('keeps novaGroup null and ingredients empty when OFF has none', () => {
    expect(product.novaGroup).toBeNull()
    expect(product.ingredients).toEqual([])
    expect(product.ingredientsRaw).toBeNull()
  })

  it('preserves declared traces tags (verdict conservatism depends on this)', () => {
    expect(product.tracesTags).toEqual(['en:milk', 'en:nuts'])
  })
})

describe('normalizeOffProduct — weird payload (strings, unknown ingredients)', () => {
  const product = normalizeOffProduct('6191509900107', parseFixture(OFF_WEIRD), FETCHED_AT)

  it('coerces numeric strings and trims the name', () => {
    expect(product.name).toBe('Harissa du Cap Bon')
    expect(product.novaGroup).toBe(3)
    // kJ-only energy converts to kcal; sodium converts to salt (x2.5)
    expect(product.nutriments.energyKcal).toBeCloseTo(90.1, 1)
    expect(product.nutriments.salt).toBeCloseTo(3, 5)
    expect(product.nutriments.fat).toBe(2.1)
    // "not-a-number" strings become null, never NaN
    expect(product.nutriments.sugars).toBeNull()
  })

  it('classifies OFF-unrecognized ingredients as unknown (fail conservative)', () => {
    const byName = new Map(product.ingredients.map((i) => [i.name, i]))
    expect(byName.get('Piments rouges')?.riskClass).toBe('unknown')
    expect(byName.get('coriandre')?.riskClass).toBe('unknown')
    expect(byName.get('sel')?.riskClass).toBe('benign') // recognized: en:salt
  })

  it('extracts "may contain" traces from the label text when tags are missing', () => {
    expect(product.tracesTags).toEqual(expect.arrayContaining(['en:celery', 'en:mustard']))
  })
})

describe('nutrimentsFromOff helpers', () => {
  it('ignores reserved "_" metadata keys', () => {
    const n = nutrimentsFromOff({ 'sugars_100g': 5, _additives_tags: ['en:e100'] })
    expect(n.sugars).toBe(5)
  })

  it('handles non-object input', () => {
    expect(nutrimentsFromOff(null).sugars).toBeNull()
    expect(nutrimentsFromOff('garbage').energyKcal).toBeNull()
  })
})

describe('classifyIngredient / text helpers', () => {
  it('matches peanut before generic nuts', () => {
    expect(classifyIngredient('peanut butter', null).allergenTags).toContain('en:peanuts')
  })
  it('treats undisclosed flavourings as unknown', () => {
    expect(classifyIngredient('natural flavourings', 'en:natural-flavouring').riskClass).toBe('unknown')
  })
  it('extracts E-numbers from raw text', () => {
    expect(additiveTagsFromText('colour: E150d, acid E338')).toEqual(['en:e150d', 'en:e338'])
  })
  it('returns no traces without a may-contain clause', () => {
    expect(tracesFromText('Sugar, palm oil.')).toEqual([])
  })
})

describe('normalizedFromProductRow (Supabase cache path)', () => {
  const row: ProductRow = {
    id: 'a2c1e1de-0000-4000-8000-000000000001',
    barcode: '3017620422003',
    name: 'Nutella',
    brand: 'Ferrero',
    categories: ['spreads', 'sweet-spreads', 'hazelnut-spreads'],
    ingredients_raw:
      'Sugar, palm oil, hazelnuts 13%, skimmed milk powder 8.7%, fat-reduced cocoa 7.4%, emulsifier: lecithin (soya), vanillin.',
    nutriments: {
      'energy-kcal_100g': 539,
      fat_100g: 30.9,
      'saturated-fat_100g': 10.6,
      carbohydrates_100g: 57.5,
      sugars_100g: 56.3,
      proteins_100g: 6.3,
      salt_100g: 0.107,
      _additives_tags: ['en:e322'],
      _traces_tags: ['en:nuts'],
    },
    nova_group: 4,
    allergen_tags: ['en:milk', 'en:nuts', 'en:soybeans'],
    off_last_fetched_at: '2026-07-01T00:00:00.000Z',
    data_source: 'openfoodfacts',
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
  }

  it('maps a cached row to the same NormalizedProduct shape', () => {
    const product = normalizedFromProductRow(row, false)
    expect(product.source).toBe('supabase-cache')
    expect(product.stale).toBe(false)
    expect(product.supabaseProductId).toBe(row.id)
    expect(product.nutriments.sugars).toBe(56.3)
    expect(product.novaGroup).toBe(4)
    expect(product.allergenTags).toEqual(['en:milk', 'en:nuts', 'en:soybeans'])
    // stashed metadata read back from the nutriments jsonb
    expect(product.additiveTags).toEqual(['en:e322'])
    expect(product.tracesTags).toEqual(['en:nuts'])
    expect(product.fetchedAt).toBe('2026-07-01T00:00:00.000Z')
    // ingredients parsed best-effort from the raw label text
    const soy = product.ingredients.find((i) => i.allergenTags.includes('en:soybeans'))
    expect(soy).toBeDefined()
  })

  it('marks stale rows and falls back to text extraction without stashed tags', () => {
    const seedStyleRow: ProductRow = {
      ...row,
      nutriments: { 'sugars_100g': 56.3 },
    }
    const product = normalizedFromProductRow(seedStyleRow, true)
    expect(product.stale).toBe(true)
    expect(product.additiveTags).toEqual([]) // no E-numbers in Nutella label text
    expect(product.tracesTags).toEqual([])
  })
})
