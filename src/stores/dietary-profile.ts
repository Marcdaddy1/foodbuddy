/**
 * Dietary profile store + verdict derivation.
 *
 * PRIVACY (CLAUDE.md hard rule #3): everything in this store is sensitive
 * health data. It must NEVER be sent to Sentry, PostHog, logs, or any
 * telemetry payload.
 *
 * VERDICT LOGIC IS PLACEHOLDER UI LOGIC. The real verdict engine (full OFF
 * taxonomy resolution, cross-contamination rules, severity weighting) lands
 * in Phase 2. What must already hold — and is unit-tested — is the
 * conservative-failure rule from CLAUDE.md hard rule #2:
 * unknown/unparseable ingredient + a declared allergy => Caution, never Safe.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { RiskClass } from '../lib/off/types'
import { canonicalAllergen, canonicalAllergenSet } from '../lib/allergens'

/* ---------------------------------------------------------------------------
 * Option catalogs (EU "14 major allergens" + common patterns)
 * ------------------------------------------------------------------------- */

export interface AllergenOption {
  tag: string
  label: string
}

export const ALLERGEN_OPTIONS: AllergenOption[] = [
  { tag: 'en:milk', label: 'Milk' },
  { tag: 'en:eggs', label: 'Eggs' },
  { tag: 'en:peanuts', label: 'Peanuts' },
  { tag: 'en:nuts', label: 'Tree nuts' },
  { tag: 'en:soybeans', label: 'Soy' },
  { tag: 'en:gluten', label: 'Gluten (wheat)' },
  { tag: 'en:fish', label: 'Fish' },
  { tag: 'en:crustaceans', label: 'Crustaceans' },
  { tag: 'en:molluscs', label: 'Molluscs' },
  { tag: 'en:celery', label: 'Celery' },
  { tag: 'en:mustard', label: 'Mustard' },
  { tag: 'en:sesame-seeds', label: 'Sesame' },
  { tag: 'en:sulphur-dioxide-and-sulphites', label: 'Sulphites' },
  { tag: 'en:lupin', label: 'Lupin' },
]

export function allergenLabel(tag: string): string {
  return ALLERGEN_OPTIONS.find((a) => a.tag === tag)?.label ?? tag.replace(/^en:/, '')
}

export interface IntoleranceOption {
  id: string
  label: string
  /** Allergen tags whose presence triggers a Caution for this intolerance. */
  tags: string[]
}

export const INTOLERANCE_OPTIONS: IntoleranceOption[] = [
  { id: 'lactose', label: 'Lactose', tags: ['en:milk'] },
  { id: 'gluten-sensitivity', label: 'Gluten sensitivity', tags: ['en:gluten'] },
  { id: 'soy', label: 'Soy', tags: ['en:soybeans'] },
  { id: 'sulphites', label: 'Sulphites', tags: ['en:sulphur-dioxide-and-sulphites'] },
]

export interface DietPatternOption {
  id: string
  label: string
  /** Allergen tags that conflict with this pattern (placeholder heuristic). */
  conflictTags: string[]
}

export const DIET_PATTERN_OPTIONS: DietPatternOption[] = [
  {
    id: 'vegan',
    label: 'Vegan',
    conflictTags: ['en:milk', 'en:eggs', 'en:fish', 'en:crustaceans', 'en:molluscs'],
  },
  {
    id: 'vegetarian',
    label: 'Vegetarian',
    conflictTags: ['en:fish', 'en:crustaceans', 'en:molluscs'],
  },
  { id: 'pescatarian', label: 'Pescatarian', conflictTags: [] },
  { id: 'low-sugar', label: 'Low sugar', conflictTags: [] },
]

export type AllergySeverity = 'mild' | 'moderate' | 'severe'

export const SEVERITIES: AllergySeverity[] = ['mild', 'moderate', 'severe']

export interface AllergyEntry {
  tag: string
  severity: AllergySeverity
}

/* ---------------------------------------------------------------------------
 * Verdict derivation — pure function, unit-tested
 * ------------------------------------------------------------------------- */

export type Verdict = 'safe' | 'caution' | 'avoid'

export interface VerdictInput {
  allergies: AllergyEntry[]
  intolerances: string[]
  dietPatterns: string[]
  customAvoid: string[]
}

export interface VerdictResult {
  verdict: Verdict
  /** Human-readable triggering rule, e.g. "Contains Milk — your allergy". */
  rule: string
}

const WORSE: Record<Verdict, number> = { safe: 0, caution: 1, avoid: 2 }

/**
 * Structural product input for verdict derivation. Both MockProduct
 * (mock-catalog) and NormalizedProduct (src/lib/off) satisfy this shape —
 * NormalizedProduct declares traces as `tracesTags`, mocks as `mayContainTags`;
 * both are honored (union) so traces are never dropped.
 */
export interface VerdictProduct {
  name: string
  ingredients: ReadonlyArray<{
    name: string
    riskClass: RiskClass
    allergenTags: ReadonlyArray<string>
  }>
  /** Declared "contains" allergen tags (OFF taxonomy, e.g. 'en:milk'). */
  allergenTags: ReadonlyArray<string>
  /** "May contain traces of…" tags (mock-catalog naming). */
  mayContainTags?: ReadonlyArray<string>
  /** "May contain traces of…" tags (OFF naming). */
  tracesTags?: ReadonlyArray<string>
}

/**
 * Derive a Safe / Caution / Avoid verdict for a product against a profile.
 *
 * Pure and deterministic — no AI, no I/O (CLAUDE.md hard rule #1).
 * PLACEHOLDER: the real Phase-2 engine adds taxonomy-tree resolution and a
 * full allergen test matrix; this covers the UI-phase rules only:
 *   1. Declared allergen present (product-level tag OR ingredient-level tag)
 *      -> Avoid (with triggering rule)
 *   2. "May contain" / traces of a declared allergen -> Caution
 *   3. Unknown ingredient + any declared allergy -> Caution (fail conservative,
 *      never Safe — CLAUDE.md hard rule #2)
 *   4. Custom avoid-list ingredient match   -> Avoid
 *   5. Intolerance tag match                -> Caution
 *   6. Diet-pattern conflict                -> Caution
 *   7. Otherwise                            -> Safe
 */
export function deriveVerdict(product: VerdictProduct, profile: VerdictInput): VerdictResult {
  let result: VerdictResult = {
    verdict: 'safe',
    rule: 'No conflicts with your dietary profile',
  }

  const consider = (verdict: Verdict, rule: string) => {
    if (WORSE[verdict] > WORSE[result.verdict]) result = { verdict, rule }
  }

  // Every allergen comparison goes through canonical resolution. Raw tag
  // equality silently missed foreign-locale tags (`fr:lait` vs `en:milk`),
  // casing, plurals, and sub-species (`en:almonds` vs `en:nuts`) — each of
  // which produced a false "Safe" on a declared allergen.
  const declared = canonicalAllergenSet(product.allergenTags)
  const fromIngredients = canonicalAllergenSet(
    product.ingredients.flatMap((i) => [...i.allergenTags]),
  )
  const traces = canonicalAllergenSet([
    ...(product.mayContainTags ?? []),
    ...(product.tracesTags ?? []),
  ])

  const containsAllergen = (tag: string): boolean => {
    const canonical = canonicalAllergen(tag)
    if (!canonical) return false
    return declared.resolved.has(canonical) || fromIngredients.resolved.has(canonical)
  }
  const tracesAllergen = (tag: string): boolean => {
    const canonical = canonicalAllergen(tag)
    return canonical ? traces.resolved.has(canonical) : false
  }

  // Any allergen-ish tag we could not resolve, anywhere on the product.
  const unresolvedTags = [
    ...declared.unresolved,
    ...fromIngredients.unresolved,
    ...traces.unresolved,
  ]

  // 1 + 2: declared allergies
  for (const allergy of profile.allergies) {
    const label = allergenLabel(allergy.tag)
    if (containsAllergen(allergy.tag)) {
      consider('avoid', `Contains ${label.toLowerCase()} — your allergy`)
    } else if (tracesAllergen(allergy.tag)) {
      // A severe allergy plus cross-contamination is not a "maybe" — someone
      // who marked anaphylaxis should be told to put it back on the shelf.
      if (allergy.severity === 'severe') {
        consider('avoid', `May contain traces of ${label.toLowerCase()} — your severe allergy`)
      } else {
        consider('caution', `May contain traces of ${label.toLowerCase()} — your allergy`)
      }
    }
  }

  // 3: conservative failure (CLAUDE.md hard rule #2). Anything we could not
  // positively verify, while the user has a declared allergy, must downgrade.
  if (profile.allergies.length > 0) {
    const unknown = product.ingredients.find((i) => i.riskClass === 'unknown')
    const hasAnyAllergenData =
      product.allergenTags.length > 0 ||
      product.ingredients.length > 0 ||
      (product.mayContainTags ?? []).length > 0 ||
      (product.tracesTags ?? []).length > 0

    if (!hasAnyAllergenData) {
      // No ingredients, no allergen tags, nothing. Previously this produced
      // "Safe for you" — the most dangerous possible answer, because absence
      // of data was being read as evidence of absence.
      consider(
        'caution',
        "We have no ingredient or allergen data for this product — check the physical label",
      )
    } else if (unknown) {
      consider(
        'caution',
        `${unknown.name} can't be fully verified — checked because of your allergies`,
      )
    } else if (unresolvedTags.length > 0) {
      // An allergen tag we do not recognise could be the user's allergen under
      // a name we have not mapped yet.
      consider(
        'caution',
        `"${unresolvedTags[0]}" isn't an allergen we recognise — checked because of your allergies`,
      )
    }
  }

  // 4: custom avoid list. Matches the allergen tags too, not just ingredient
  // text — a user tracking something outside the 14-allergen list was
  // previously on a strictly weaker path than a declared allergy.
  for (const term of profile.customAvoid) {
    const needle = term.trim().toLowerCase()
    if (!needle) continue
    // Word-boundary match so "at" does not fire on "oat base".
    const boundary = new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    const hit =
      product.ingredients.some((i) => boundary.test(i.name)) ||
      boundary.test(product.name) ||
      containsAllergen(needle)
    if (hit) consider('avoid', `Contains ${term.trim()} — on your avoid list`)
  }

  // 5: intolerances — same canonical matcher as allergies, and traces count.
  for (const id of profile.intolerances) {
    const option = INTOLERANCE_OPTIONS.find((o) => o.id === id)
    if (!option) continue
    const hitTag = option.tags.find((tag) => containsAllergen(tag))
    if (hitTag) {
      consider(
        'caution',
        `Contains ${allergenLabel(hitTag).toLowerCase()} — your ${option.label.toLowerCase()} intolerance`,
      )
      continue
    }
    const traceTag = option.tags.find((tag) => tracesAllergen(tag))
    if (traceTag) {
      consider(
        'caution',
        `May contain traces of ${allergenLabel(traceTag).toLowerCase()} — your ${option.label.toLowerCase()} intolerance`,
      )
    }
  }

  // 6: diet patterns (placeholder heuristic — Phase 2 uses full taxonomy)
  for (const id of profile.dietPatterns) {
    const option = DIET_PATTERN_OPTIONS.find((o) => o.id === id)
    if (!option) continue
    const hitTag = option.conflictTags.find((tag) => containsAllergen(tag))
    if (hitTag) {
      consider('caution', `Contains ${allergenLabel(hitTag).toLowerCase()} — not ${option.label.toLowerCase()}`)
    }
  }

  return result
}

/* ---------------------------------------------------------------------------
 * Zustand store (persisted to localStorage)
 * ------------------------------------------------------------------------- */

/**
 * Hydration status. This is a SAFETY signal, not a loading spinner: if the
 * stored profile cannot be read, the store falls back to empty — and an empty
 * profile makes `deriveVerdict` return "Safe for you" for everything, because
 * every allergy rule is skipped. That must never happen silently, so the UI
 * reads this and warns instead.
 */
export type ProfileHydration = 'pending' | 'ready' | 'failed'

interface DietaryProfileState extends VerdictInput {
  hydration: ProfileHydration
  toggleAllergy: (tag: string) => void
  setAllergySeverity: (tag: string, severity: AllergySeverity) => void
  toggleIntolerance: (id: string) => void
  toggleDietPattern: (id: string) => void
  addCustomAvoid: (term: string) => void
  removeCustomAvoid: (term: string) => void
}

/**
 * Repairs a persisted profile into a shape the app can safely render.
 * Applied on EVERY load, not just on a version change: a malformed entry in a
 * current-version profile would otherwise reach `allergenLabel` and throw.
 */
function sanitizeProfile(raw: Partial<VerdictInput> | undefined): VerdictInput {
  const strings = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  return {
    allergies: Array.isArray(raw?.allergies)
      ? raw.allergies.filter(
          (a): a is AllergyEntry =>
            !!a && typeof a === 'object' && typeof (a as AllergyEntry).tag === 'string',
        )
      : [],
    intolerances: strings(raw?.intolerances),
    dietPatterns: strings(raw?.dietPatterns),
    customAvoid: strings(raw?.customAvoid),
  }
}

export const DIETARY_PROFILE_STORAGE_KEY = 'foodbuddy-dietary-profile'

export const useDietaryProfileStore = create<DietaryProfileState>()(
  persist(
    (set) => ({
      hydration: 'pending' as ProfileHydration,
      allergies: [],
      intolerances: [],
      dietPatterns: [],
      customAvoid: [],

      toggleAllergy: (tag) =>
        set((s) => ({
          allergies: s.allergies.some((a) => a.tag === tag)
            ? s.allergies.filter((a) => a.tag !== tag)
            : [...s.allergies, { tag, severity: 'moderate' as const }],
        })),

      setAllergySeverity: (tag, severity) =>
        set((s) => ({
          allergies: s.allergies.map((a) => (a.tag === tag ? { ...a, severity } : a)),
        })),

      toggleIntolerance: (id) =>
        set((s) => ({
          intolerances: s.intolerances.includes(id)
            ? s.intolerances.filter((x) => x !== id)
            : [...s.intolerances, id],
        })),

      toggleDietPattern: (id) =>
        set((s) => ({
          dietPatterns: s.dietPatterns.includes(id)
            ? s.dietPatterns.filter((x) => x !== id)
            : [...s.dietPatterns, id],
        })),

      addCustomAvoid: (term) =>
        set((s) => {
          const clean = term.trim()
          if (!clean || s.customAvoid.some((t) => t.toLowerCase() === clean.toLowerCase())) {
            return s
          }
          return { customAvoid: [...s.customAvoid, clean] }
        }),

      removeCustomAvoid: (term) =>
        set((s) => ({ customAvoid: s.customAvoid.filter((t) => t !== term) })),
    }),
    {
      name: DIETARY_PROFILE_STORAGE_KEY,
      version: 1,

      // Only persist data, never the actions or the hydration flag — a stored
      // `hydration: 'ready'` would defeat the whole point on the next boot.
      partialize: (s) => ({
        allergies: s.allergies,
        intolerances: s.intolerances,
        dietPatterns: s.dietPatterns,
        customAvoid: s.customAvoid,
      }),

      // Without a migrate fn, zustand DISCARDS state whose version differs and
      // silently continues with an empty profile. For allergy data that is a
      // safety failure, so every shape is repaired rather than dropped.
      migrate: (persisted) => sanitizeProfile(persisted as Partial<VerdictInput>),

      onRehydrateStorage: () => (state, error) => {
        // Rehydration runs synchronously inside create(), so the store const is
        // still in its temporal dead zone here — touching it directly throws a
        // ReferenceError that zustand swallows, and the status silently never
        // updates. Defer past creation.
        const next: Partial<DietaryProfileState> =
          error || !state
            ? // Corrupt/unreadable storage. Surface it — never pretend the user
              // simply has no allergies, because an empty profile makes every
              // product read "Safe for you".
              { hydration: 'failed' }
            : { hydration: 'ready', ...sanitizeProfile(state) }
        queueMicrotask(() => useDietaryProfileStore.setState(next))
      },
    },
  ),
)
