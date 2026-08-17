/**
 * PRIVACY GATE — CLAUDE.md hard rule #3.
 *
 * Dietary and allergy data is health-related personal data. It must never
 * reach Sentry or PostHog. An audit found the original scrub inspected only
 * `event.contexts` and `event.extra`, while the actual leak was elsewhere:
 * Sentry's DOM breadcrumbs serialise the clicked element's id and aria-label,
 * so tapping a severity dropdown on the profile screen emitted
 * `select#severity-en:peanuts` — the user's declared allergen, verbatim.
 *
 * These tests exercise the real predicate the SDK hooks call. Treat a failure
 * here as a release blocker, not a flaky test.
 */
import { describe, expect, it } from 'vitest'
import { containsSensitiveData } from './telemetry'

describe('containsSensitiveData — what must never leave the device', () => {
  const mustBlock: Array<[string, unknown]> = [
    ['allergen tag in a DOM breadcrumb', 'select#severity-en:peanuts'],
    ['aria-label naming an avoid-list entry', 'button[aria-label="Remove palm oil from avoid list"]'],
    ['the word allergies in a payload', { allergies: [{ tag: 'en:milk' }] }],
    ['a dietary profile object', { dietaryProfile: { intolerances: ['lactose'] } }],
    ['the storage key', 'foodbuddy-dietary-profile'],
    ['an intolerance mention', { note: 'user has an intolerance' }],
    ['a raw milk allergen tag', 'en:milk'],
    ['a gluten allergen tag in a URL', 'https://example.test/x?tag=en:gluten'],
    ['nested deep in an object', { a: { b: { c: 'en:sesame' } } }],
    ['diet_profile key', { diet_profile: 'x' }],
  ]

  it.each(mustBlock)('blocks: %s', (_label, value) => {
    expect(containsSensitiveData(value)).toBe(true)
  })

  const mustAllow: Array<[string, unknown]> = [
    ['an ordinary error message', 'TypeError: cannot read property of undefined'],
    ['a product barcode', { barcode: '3017620422003' }],
    ['a navigation breadcrumb', 'navigation from /history to /lists'],
    ['an anonymous scan count', { scans: 12 }],
    ['a null value', null],
    ['an undefined value', undefined],
  ]

  it.each(mustAllow)('allows: %s', (_label, value) => {
    expect(containsSensitiveData(value)).toBe(false)
  })

  it('fails closed on an unserialisable value', () => {
    // A circular object cannot be inspected, so it must be treated as unsafe
    // rather than waved through.
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(containsSensitiveData(circular)).toBe(true)
  })
})
