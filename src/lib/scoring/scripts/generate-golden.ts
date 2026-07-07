/**
 * One-time (per rule change) golden-file generator.
 *
 * Reads the committed OFF fixture, scores every product with the current
 * engine, and writes __fixtures__/golden-scores.json. The COMMITTED output
 * is the source of truth for golden.test.ts — after any rule change:
 *
 *   npx tsx src/lib/scoring/scripts/generate-golden.ts
 *
 * then SANITY-REVIEW the diff (waters/plain foods high, sodas/candy low)
 * and bump RULE_VERSION before committing. Never runs at test/app runtime.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { RULE_VERSION, scoreProduct } from '../index'
import { offProductToScoringInput, type OffProduct } from '../off-input-mapping'

const fixtureUrl = new URL(
  '../__fixtures__/off-popular-products.json',
  import.meta.url,
)
const goldenUrl = new URL('../__fixtures__/golden-scores.json', import.meta.url)

const raw = JSON.parse(readFileSync(fixtureUrl, 'utf-8')) as {
  products: OffProduct[]
}

const golden = {
  ruleVersion: RULE_VERSION,
  generatedFrom: 'off-popular-products.json',
  entries: raw.products.map((product) => ({
    code: product.code ?? '',
    name: product.product_name ?? '',
    brands: product.brands ?? '',
    result: scoreProduct(offProductToScoringInput(product)),
  })),
}

writeFileSync(goldenUrl, `${JSON.stringify(golden, null, 2)}\n`, 'utf-8')

console.log(
  `Wrote ${golden.entries.length} golden entries (ruleVersion ${RULE_VERSION})`,
)
for (const entry of golden.entries) {
  console.log(
    `${entry.result.grade} ${String(entry.result.score).padStart(3)} ` +
      `${entry.code} ${entry.name}` +
      (entry.result.lowConfidence ? ' [low-confidence]' : ''),
  )
}
