/**
 * ALLERGEN MATRIX — release gate (CLAUDE.md hard rule #4).
 *
 * This suite exists because an audit found that every case in the original
 * tests used byte-exact `en:` tags produced by our own picker, so a whole class
 * of real-world data shapes returned a false "Safe for you":
 *
 *   fr:lait / de:milch  (foreign locale)      -> was Safe with a milk allergy
 *   en:Milk / EN:MILK   (casing)              -> was Safe
 *   en:milks / en:dairy (plural / synonym)    -> was Safe
 *   en:almonds          (sub-species of nuts) -> was Safe
 *   no data at all      (empty product)       -> was Safe
 *
 * The governing rule (hard rule #2) is that anything we cannot positively
 * verify must NOT come back Safe. A false Avoid is an inconvenience; a false
 * Safe is an allergic reaction.
 *
 * Do not weaken a case here to make a change pass. Fix the matcher.
 */
import { describe, expect, it } from 'vitest'
import { deriveVerdict, type VerdictInput, type VerdictProduct } from './dietary-profile'

const NO_PROFILE: VerdictInput = {
  allergies: [],
  intolerances: [],
  dietPatterns: [],
  customAvoid: [],
}

const withAllergy = (tag: string, severity: 'mild' | 'moderate' | 'severe' = 'moderate'): VerdictInput => ({
  ...NO_PROFILE,
  allergies: [{ tag, severity }],
})

/** A product that is fully described — so only the tag under test can matter. */
const product = (over: Partial<VerdictProduct> = {}): VerdictProduct => ({
  name: 'Test product',
  ingredients: [{ name: 'Sugar', riskClass: 'benign', allergenTags: [] }],
  allergenTags: [],
  tracesTags: [],
  ...over,
})

describe('allergen matrix — tag shapes must never yield a false Safe', () => {
  // Each row: the user's declared allergy, and a tag shape OFF really uses.
  const shapes: Array<[string, string, string]> = [
    ['en:milk', 'en:milk', 'exact'],
    ['en:milk', 'fr:lait', 'french locale'],
    ['en:milk', 'de:milch', 'german locale'],
    ['en:milk', 'es:leche', 'spanish locale'],
    ['en:milk', 'it:latte', 'italian locale'],
    ['en:milk', 'en:Milk', 'capitalised'],
    ['en:milk', 'EN:MILK', 'uppercase'],
    ['en:milk', 'milk', 'no locale prefix'],
    ['en:milk', 'en:milks', 'plural'],
    ['en:milk', 'en:dairy', 'synonym'],
    ['en:milk', 'en:cows-milk', 'sub-species'],
    ['en:milk', 'en:milk-proteins', 'derivative'],
    ['en:gluten', 'en:wheat', 'gluten grain'],
    ['en:gluten', 'en:barley', 'gluten grain'],
    ['en:gluten', 'en:oats', 'gluten grain'],
    ['en:gluten', 'en:spelt', 'gluten grain'],
    ['en:gluten', 'fr:ble', 'french gluten'],
    ['en:gluten', 'de:weizen', 'german gluten'],
    ['en:nuts', 'en:almonds', 'sub-species'],
    ['en:nuts', 'en:hazelnuts', 'sub-species'],
    ['en:nuts', 'en:cashew-nuts', 'sub-species'],
    ['en:nuts', 'en:walnuts', 'sub-species'],
    ['en:nuts', 'fr:fruits-a-coque', 'french nuts'],
    ['en:nuts', 'en:marzipan', 'prepared derivative'],
    ['en:soybeans', 'en:soya', 'variant'],
    ['en:soybeans', 'en:soy', 'variant'],
    ['en:soybeans', 'en:tofu', 'derivative'],
    ['en:eggs', 'en:egg', 'singular'],
    ['en:eggs', 'fr:oeuf', 'french eggs'],
    ['en:eggs', 'en:albumen', 'derivative'],
    ['en:peanuts', 'en:groundnuts', 'synonym'],
    ['en:peanuts', 'fr:arachide', 'french peanut'],
    ['en:sesame-seeds', 'en:sesame', 'short form'],
    ['en:sesame-seeds', 'en:tahini', 'derivative'],
    ['en:crustaceans', 'en:prawns', 'sub-species'],
    ['en:crustaceans', 'en:shellfish', 'synonym'],
    ['en:molluscs', 'en:squid', 'sub-species'],
    ['en:fish', 'en:anchovy', 'sub-species'],
    ['en:celery', 'fr:celeri', 'french celery'],
    ['en:mustard', 'de:senf', 'german mustard'],
    ['en:sulphur-dioxide-and-sulphites', 'en:sulphites', 'short form'],
    ['en:lupin', 'en:lupine', 'variant'],
  ]

  it.each(shapes)(
    'declared %s vs product tag %s (%s) -> avoid',
    (allergy, tag) => {
      const result = deriveVerdict(product({ allergenTags: [tag] }), withAllergy(allergy))
      expect(result.verdict).toBe('avoid')
    },
  )

  it.each(shapes)(
    'declared %s vs TRACES tag %s (%s) -> never safe',
    (allergy, tag) => {
      const result = deriveVerdict(product({ tracesTags: [tag] }), withAllergy(allergy))
      expect(result.verdict).not.toBe('safe')
    },
  )

  it.each(shapes)(
    'declared %s vs INGREDIENT-level tag %s (%s) -> avoid',
    (allergy, tag) => {
      const result = deriveVerdict(
        product({
          ingredients: [{ name: 'Some ingredient', riskClass: 'allergen', allergenTags: [tag] }],
        }),
        withAllergy(allergy),
      )
      expect(result.verdict).toBe('avoid')
    },
  )
})

describe('conservative failure — absence of data is not evidence of safety', () => {
  it('a product with NO ingredients and NO allergen tags is never Safe for an allergy holder', () => {
    const empty: VerdictProduct = {
      name: 'Mystery item',
      ingredients: [],
      allergenTags: [],
      tracesTags: [],
    }
    expect(deriveVerdict(empty, withAllergy('en:peanuts')).verdict).not.toBe('safe')
  })

  it('an unrecognised allergen tag is never Safe for an allergy holder', () => {
    const result = deriveVerdict(
      product({ allergenTags: ['en:some-unmapped-allergen'] }),
      withAllergy('en:milk'),
    )
    expect(result.verdict).not.toBe('safe')
  })

  it('an unknown-class ingredient is never Safe for an allergy holder', () => {
    const result = deriveVerdict(
      product({ ingredients: [{ name: 'E-something', riskClass: 'unknown', allergenTags: [] }] }),
      withAllergy('en:milk'),
    )
    expect(result.verdict).not.toBe('safe')
  })

  it('stays Safe when the user has declared no allergies at all', () => {
    // The conservative rules must not fire for users with no profile, or every
    // product would read Caution and the verdict would carry no information.
    const empty: VerdictProduct = {
      name: 'Mystery item',
      ingredients: [],
      allergenTags: [],
      tracesTags: [],
    }
    expect(deriveVerdict(empty, NO_PROFILE).verdict).toBe('safe')
  })
})

describe('severity affects cross-contamination handling', () => {
  it('escalates traces to Avoid for a severe allergy', () => {
    const result = deriveVerdict(
      product({ tracesTags: ['en:peanuts'] }),
      withAllergy('en:peanuts', 'severe'),
    )
    expect(result.verdict).toBe('avoid')
    expect(result.rule).toMatch(/severe/i)
  })

  it('keeps traces at Caution for a mild allergy', () => {
    const result = deriveVerdict(
      product({ tracesTags: ['en:peanuts'] }),
      withAllergy('en:peanuts', 'mild'),
    )
    expect(result.verdict).toBe('caution')
  })
})

describe('intolerances get the same matching rigour as allergies', () => {
  it('matches a foreign-locale tag', () => {
    const result = deriveVerdict(product({ allergenTags: ['fr:lait'] }), {
      ...NO_PROFILE,
      intolerances: ['lactose'],
    })
    expect(result.verdict).toBe('caution')
  })

  it('flags traces, not just declared contents', () => {
    const result = deriveVerdict(product({ tracesTags: ['en:gluten'] }), {
      ...NO_PROFILE,
      intolerances: ['gluten-sensitivity'],
    })
    expect(result.verdict).toBe('caution')
  })
})

describe('custom avoid list', () => {
  it('matches an allergen tag, not only ingredient text', () => {
    const result = deriveVerdict(product({ allergenTags: ['en:milk'] }), {
      ...NO_PROFILE,
      customAvoid: ['milk'],
    })
    expect(result.verdict).toBe('avoid')
  })

  it('does not fire on a substring inside another word', () => {
    // "at" must not match "oat base" — the old substring match did.
    const result = deriveVerdict(
      product({ ingredients: [{ name: 'Oat base (water, oats)', riskClass: 'benign', allergenTags: [] }] }),
      { ...NO_PROFILE, customAvoid: ['at'] },
    )
    expect(result.verdict).toBe('safe')
  })
})
