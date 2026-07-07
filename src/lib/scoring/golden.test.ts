/**
 * Golden-file release gate (Phase 1): every fixture product must score
 * exactly what the committed golden file says. Fixtures are committed —
 * these tests NEVER touch the network.
 *
 * If a rule change is intentional: regenerate with
 *   npx tsx src/lib/scoring/scripts/generate-golden.ts
 * sanity-review the diff, and bump RULE_VERSION.
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { RULE_VERSION, scoreProduct, type ScoreResult } from './index'
import { offProductToScoringInput, type OffProduct } from './off-input-mapping'

function readJson<T>(relativePath: string): T {
  return JSON.parse(
    readFileSync(new URL(relativePath, import.meta.url), 'utf-8'),
  ) as T
}

const fixture = readJson<{ products: OffProduct[] }>(
  './__fixtures__/off-popular-products.json',
)
const golden = readJson<{
  ruleVersion: string
  entries: { code: string; name: string; result: ScoreResult }[]
}>('./__fixtures__/golden-scores.json')

describe('golden scores (release gate)', () => {
  it('has a golden entry for every fixture product', () => {
    expect(fixture.products.length).toBeGreaterThanOrEqual(40)
    expect(golden.entries.length).toBe(fixture.products.length)
  })

  it('goldens were generated with the current rule version', () => {
    expect(golden.ruleVersion).toBe(RULE_VERSION)
  })

  fixture.products.forEach((product, i) => {
    const entry = golden.entries[i]
    it(`#${i} ${entry.code} ${entry.name || '(unnamed)'} → ${entry.result.grade} ${entry.result.score}`, () => {
      expect(product.code ?? '').toBe(entry.code)
      const result = scoreProduct(offProductToScoringInput(product))
      expect(result).toEqual(entry.result)
    })
  })

  it('sanity: Coca-Cola scores low (D/E)', () => {
    const coke = golden.entries.find((e) => e.code === '5449000054227')
    expect(coke).toBeDefined()
    expect(['D', 'E']).toContain(coke!.result.grade)
  })

  it('sanity: Nutella-style spreads score low (D/E)', () => {
    const nutella = golden.entries.find((e) => e.code === '3017620422003')
    expect(nutella).toBeDefined()
    expect(['D', 'E']).toContain(nutella!.result.grade)
  })

  it('sanity: plain water with full data scores high (A/B)', () => {
    const water = golden.entries.find((e) => e.code === '6111128000071')
    expect(water).toBeDefined()
    expect(['A', 'B']).toContain(water!.result.grade)
  })

  it('sanity: plain skyr/yogurt scores high (A/B)', () => {
    const skyr = golden.entries.find((e) => e.code === '3329770077003')
    expect(skyr).toBeDefined()
    expect(['A', 'B']).toContain(skyr!.result.grade)
  })
})
