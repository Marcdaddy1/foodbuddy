/**
 * Unit tests for the deterministic scoring engine v1 — determinism,
 * beverage banding, missing-data conservatism, additive handling,
 * grade boundaries, and additive-risk table integrity.
 */

import { describe, expect, it } from 'vitest'
import {
  COMPOSITE_WEIGHTS,
  RULE_VERSION,
  gradeForScore,
  scoreProduct,
  type NutrimentsPer100,
  type ScoringInput,
} from './index'
import riskTable from './data/additive-risk.json'

function nutriments(partial: Partial<NutrimentsPer100>): NutrimentsPer100 {
  return {
    energyKcal: null,
    fat: null,
    saturatedFat: null,
    carbohydrates: null,
    sugars: null,
    proteins: null,
    salt: null,
    fiber: null,
    ...partial,
  }
}

function input(partial: Partial<ScoringInput>): ScoringInput {
  return {
    nutriments: nutriments({}),
    novaGroup: null,
    additiveTags: [],
    categories: [],
    ...partial,
  }
}

/** Coca-Cola-shaped input (per 100 ml). */
const cokeLike = input({
  nutriments: nutriments({
    energyKcal: 42,
    fat: 0,
    saturatedFat: 0,
    carbohydrates: 10.6,
    sugars: 10.6,
    proteins: 0,
    salt: 0,
    fiber: 0,
  }),
  novaGroup: 4,
  additiveTags: ['en:e150d', 'en:e290', 'en:e338'],
  categories: ['en:beverages', 'en:carbonated-drinks', 'en:sodas'],
})

/** Plain dry pasta-shaped input (per 100 g). */
const pastaLike = input({
  nutriments: nutriments({
    energyKcal: 371,
    fat: 1.5,
    saturatedFat: 0.3,
    carbohydrates: 75,
    sugars: 3.5,
    proteins: 13,
    salt: 0.01,
    fiber: 3,
  }),
  novaGroup: 1,
  additiveTags: [],
  categories: ['en:plant-based-foods-and-beverages', 'en:pastas'],
})

describe('scoreProduct', () => {
  it('is deterministic: same input → identical output', () => {
    const a = scoreProduct(cokeLike)
    const b = scoreProduct(cokeLike)
    expect(a).toEqual(b)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('reports the v1 rule version', () => {
    expect(RULE_VERSION).toBe('v1.0.0')
    expect(scoreProduct(pastaLike).ruleVersion).toBe('v1.0.0')
  })

  it('weights sum to 1', () => {
    expect(
      COMPOSITE_WEIGHTS.nutrition +
        COMPOSITE_WEIGHTS.additives +
        COMPOSITE_WEIGHTS.processing,
    ).toBeCloseTo(1)
  })

  it('scores a soda-like product worse than a plain-pasta-like product', () => {
    const coke = scoreProduct(cokeLike)
    const pasta = scoreProduct(pastaLike)
    expect(coke.score).toBeLessThan(pasta.score)
    expect(['D', 'E']).toContain(coke.grade)
    expect(['A', 'B']).toContain(pasta.grade)
  })

  it('bands beverages stricter than solids for the same nutriments', () => {
    const sugary = nutriments({
      energyKcal: 40,
      sugars: 9,
      saturatedFat: 0,
      salt: 0,
      proteins: 0,
      fiber: 0,
    })
    const asBeverage = scoreProduct(
      input({ nutriments: sugary, novaGroup: 3, categories: ['en:beverages'] }),
    )
    const asSolid = scoreProduct(
      input({ nutriments: sugary, novaGroup: 3, categories: ['en:desserts'] }),
    )
    expect(asBeverage.breakdown.nutrition).toBeLessThan(
      asSolid.breakdown.nutrition,
    )
  })

  it('does not treat "…-foods-and-beverages" umbrella categories as beverages', () => {
    const solid = scoreProduct(
      input({
        nutriments: pastaLike.nutriments,
        novaGroup: 1,
        categories: ['en:plant-based-foods-and-beverages'],
      }),
    )
    const beverage = scoreProduct(
      input({
        nutriments: pastaLike.nutriments,
        novaGroup: 1,
        categories: ['en:beverages'],
      }),
    )
    // Pasta nutriments banded as a beverage would be much worse.
    expect(solid.breakdown.nutrition).toBeGreaterThan(
      beverage.breakdown.nutrition,
    )
  })

  it('marks lowConfidence when core nutrients are missing, scores conservatively', () => {
    const empty = scoreProduct(input({ novaGroup: null }))
    expect(empty.lowConfidence).toBe(true)
    expect(empty.breakdown.processing).toBe(50)
    expect(empty.flags.some((f) => f.tag === 'limited-data')).toBe(true)
    // Mid-band conservatism: missing everything must not score well.
    expect(empty.score).toBeLessThan(60)

    const full = scoreProduct(pastaLike)
    expect(full.lowConfidence).toBe(false)
  })

  it('treats NOVA null as neutral 50 and NOVA groups per the documented map', () => {
    const base = { nutriments: pastaLike.nutriments, categories: [] }
    expect(scoreProduct(input({ ...base, novaGroup: 1 })).breakdown.processing).toBe(100)
    expect(scoreProduct(input({ ...base, novaGroup: 2 })).breakdown.processing).toBe(80)
    expect(scoreProduct(input({ ...base, novaGroup: 3 })).breakdown.processing).toBe(50)
    expect(scoreProduct(input({ ...base, novaGroup: 4 })).breakdown.processing).toBe(15)
    expect(scoreProduct(input({ ...base, novaGroup: null })).breakdown.processing).toBe(50)
  })

  it('flags NOVA 4 as ultra-processed', () => {
    const result = scoreProduct(input({ ...pastaLike, novaGroup: 4 }))
    expect(result.flags.some((f) => f.tag === 'ultra-processed')).toBe(true)
  })

  it('deducts a small conservative amount for unknown additives', () => {
    const known = scoreProduct(input({ additiveTags: [] }))
    const unknown = scoreProduct(input({ additiveTags: ['en:e9999'] }))
    expect(unknown.breakdown.additives).toBe(
      known.breakdown.additives - riskTable.unknownDeduction,
    )
    expect(unknown.flags.some((f) => f.tag === 'additives-unrecognized')).toBe(
      true,
    )
  })

  it('deducts by risk class and flags concerning additives worst-first', () => {
    const result = scoreProduct(
      input({
        nutriments: nutriments({
          energyKcal: 250,
          sugars: 30,
          saturatedFat: 1,
          salt: 0.5,
        }),
        novaGroup: 4,
        additiveTags: ['en:e150d', 'en:e250'], // moderate + high_concern
      }),
    )
    // 100 - 15 (e150d moderate) - 30 (e250 high) = 55
    expect(result.breakdown.additives).toBe(55)
    expect(result.flags[0]).toEqual({
      tag: 'additive-high-concern:e250',
      label: 'Contains Sodium nitrite (E250)',
      severity: 'high',
    })
    expect(
      result.flags.some((f) => f.tag === 'additive-moderate:e150d'),
    ).toBe(true)
    // high-sugar warn present, ordered after the high-severity additive flag
    const highSugarIndex = result.flags.findIndex((f) => f.tag === 'high-sugar')
    expect(highSugarIndex).toBeGreaterThan(0)
  })

  it('dedupes additive variants and repeated tags (e322 + e322i, e250 twice)', () => {
    const lecithins = scoreProduct(
      input({ additiveTags: ['en:e322', 'en:e322i'] }),
    )
    expect(lecithins.breakdown.additives).toBe(100) // no_concern, counted once

    const nitriteTwice = scoreProduct(
      input({ additiveTags: ['en:e250', 'en:e250'] }),
    )
    expect(nitriteTwice.breakdown.additives).toBe(70) // deducted once
    expect(
      nitriteTwice.flags.filter((f) => f.tag === 'additive-high-concern:e250')
        .length,
    ).toBe(1)
  })

  it('flags high sugar / salt / saturated fat', () => {
    const result = scoreProduct(
      input({
        nutriments: nutriments({
          energyKcal: 500,
          sugars: 40,
          saturatedFat: 12,
          salt: 2,
        }),
        novaGroup: 3,
      }),
    )
    const tags = result.flags.map((f) => f.tag)
    expect(tags).toContain('high-sugar')
    expect(tags).toContain('high-saturated-fat')
    expect(tags).toContain('high-salt')
  })
})

describe('gradeForScore boundaries', () => {
  it.each([
    [100, 'A'],
    [80, 'A'],
    [79, 'B'],
    [60, 'B'],
    [59, 'C'],
    [40, 'C'],
    [39, 'D'],
    [20, 'D'],
    [19, 'E'],
    [0, 'E'],
  ] as const)('%i → %s', (score, grade) => {
    expect(gradeForScore(score)).toBe(grade)
  })
})

describe('additive-risk table integrity', () => {
  it('covers at least 60 additives', () => {
    expect(Object.keys(riskTable.additives).length).toBeGreaterThanOrEqual(60)
  })

  it('every additive references a defined class; every class has citations', () => {
    for (const [code, entry] of Object.entries(riskTable.additives)) {
      expect(code).toMatch(/^e\d{3,4}[a-z]?$/)
      expect(riskTable.classes[entry.class]).toBeDefined()
      expect(entry.name.length).toBeGreaterThan(0)
    }
    for (const info of Object.values(riskTable.classes)) {
      expect(info.citations.length).toBeGreaterThan(0)
      expect(info.deduction).toBeGreaterThanOrEqual(0)
    }
  })

  it('deductions are ordered by concern level', () => {
    const { classes } = riskTable
    expect(classes.high_concern.deduction).toBeGreaterThan(
      classes.moderate.deduction,
    )
    expect(classes.moderate.deduction).toBeGreaterThan(classes.low.deduction)
    expect(classes.low.deduction).toBeGreaterThan(classes.no_concern.deduction)
    expect(classes.no_concern.deduction).toBe(0)
    expect(riskTable.unknownDeduction).toBeGreaterThan(0)
  })

  it('key known-risk additives are classified as expected', () => {
    expect(riskTable.additives['e171'].class).toBe('high_concern') // TiO2, EU-banned
    expect(riskTable.additives['e250'].class).toBe('high_concern') // nitrite
    expect(riskTable.additives['e951'].class).toBe('high_concern') // aspartame
    expect(riskTable.additives['e320'].class).toBe('high_concern') // BHA
    expect(riskTable.additives['e211'].class).toBe('moderate') // benzoate
    expect(riskTable.additives['e621'].class).toBe('moderate') // MSG
    expect(riskTable.additives['e300'].class).toBe('no_concern') // vitamin C
  })
})
