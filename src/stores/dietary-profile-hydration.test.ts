/**
 * Profile hydration — safety regression tests.
 *
 * An empty allergy list makes `deriveVerdict` return "Safe for you" for every
 * product, because each allergy rule is skipped. So the difference between
 * "this user has no allergies" and "we could not read this user's allergies"
 * is the difference between a correct verdict and a dangerous one, and it has
 * to be observable.
 *
 * The original implementation set the status by touching the store from inside
 * `onRehydrateStorage`, which runs synchronously during `create()` while the
 * store binding is still in its temporal dead zone — zustand swallowed the
 * ReferenceError and the status never updated. Only a live check caught it,
 * hence these tests.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DIETARY_PROFILE_STORAGE_KEY } from './dietary-profile'

/** Fresh module instance so persist re-reads localStorage. */
async function loadStoreWith(stored: string | null) {
  localStorage.clear()
  if (stored !== null) localStorage.setItem(DIETARY_PROFILE_STORAGE_KEY, stored)
  vi.resetModules()
  const mod = await import('./dietary-profile')
  // Hydration status is applied in a microtask, after create() returns.
  await new Promise((r) => setTimeout(r, 0))
  return mod.useDietaryProfileStore.getState()
}

beforeEach(() => {
  localStorage.clear()
})

describe('hydration status', () => {
  it('reports failed when the stored profile is truncated JSON', async () => {
    const state = await loadStoreWith('{"state":{"allergies":')
    expect(state.hydration).toBe('failed')
  })

  it('reports failed when the stored value is not JSON at all', async () => {
    const state = await loadStoreWith('not json at all')
    expect(state.hydration).toBe('failed')
  })

  it('reports ready and restores allergies for a valid profile', async () => {
    const state = await loadStoreWith(
      JSON.stringify({
        state: {
          allergies: [{ tag: 'en:peanuts', severity: 'severe' }],
          intolerances: [],
          dietPatterns: [],
          customAvoid: [],
        },
        version: 1,
      }),
    )
    expect(state.hydration).toBe('ready')
    expect(state.allergies).toEqual([{ tag: 'en:peanuts', severity: 'severe' }])
  })

  it('reports ready with an empty profile when nothing is stored', async () => {
    // A first-run user genuinely has no profile — that must not look like a
    // failure, or every new user would see the warning.
    const state = await loadStoreWith(null)
    expect(state.hydration).toBe('ready')
    expect(state.allergies).toEqual([])
  })

  it('migrates an older version instead of silently discarding it', async () => {
    // Without a migrate fn, zustand drops mismatched-version state entirely —
    // a schema bump would wipe every user's allergies with no warning.
    const state = await loadStoreWith(
      JSON.stringify({
        state: {
          allergies: [{ tag: 'en:milk', severity: 'moderate' }],
          intolerances: ['lactose'],
          dietPatterns: [],
          customAvoid: [],
        },
        version: 0,
      }),
    )
    expect(state.allergies).toEqual([{ tag: 'en:milk', severity: 'moderate' }])
    expect(state.intolerances).toEqual(['lactose'])
  })

  it('repairs wrong-typed fields rather than crashing on them', async () => {
    const state = await loadStoreWith(
      JSON.stringify({
        state: { allergies: null, intolerances: 'oops', dietPatterns: 42, customAvoid: {} },
        version: 1,
      }),
    )
    expect(Array.isArray(state.allergies)).toBe(true)
    expect(Array.isArray(state.intolerances)).toBe(true)
    expect(Array.isArray(state.dietPatterns)).toBe(true)
    expect(Array.isArray(state.customAvoid)).toBe(true)
  })

  it('drops malformed allergy entries but keeps the valid ones', async () => {
    const state = await loadStoreWith(
      JSON.stringify({
        state: {
          allergies: [{ tag: 'en:milk', severity: 'severe' }, null, 'garbage', { severity: 'mild' }],
          intolerances: [],
          dietPatterns: [],
          customAvoid: [],
        },
        version: 1,
      }),
    )
    expect(state.allergies).toEqual([{ tag: 'en:milk', severity: 'severe' }])
  })
})
