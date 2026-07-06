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
import type { MockProduct } from '../lib/mock-catalog'

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
 * Derive a Safe / Caution / Avoid verdict for a product against a profile.
 *
 * Pure and deterministic — no AI, no I/O (CLAUDE.md hard rule #1).
 * PLACEHOLDER: the real Phase-2 engine adds taxonomy-tree resolution and a
 * full allergen test matrix; this covers the UI-phase rules only:
 *   1. Declared allergen present            -> Avoid  (with triggering rule)
 *   2. "May contain" a declared allergen    -> Caution
 *   3. Unknown ingredient + any declared allergy -> Caution (fail conservative,
 *      never Safe — CLAUDE.md hard rule #2)
 *   4. Custom avoid-list ingredient match   -> Avoid
 *   5. Intolerance tag match                -> Caution
 *   6. Diet-pattern conflict                -> Caution
 *   7. Otherwise                            -> Safe
 */
export function deriveVerdict(product: MockProduct, profile: VerdictInput): VerdictResult {
  let result: VerdictResult = {
    verdict: 'safe',
    rule: 'No conflicts with your dietary profile',
  }

  const consider = (verdict: Verdict, rule: string) => {
    if (WORSE[verdict] > WORSE[result.verdict]) result = { verdict, rule }
  }

  const ingredientTags = new Set(product.ingredients.flatMap((i) => i.allergenTags))
  const containsTag = (tag: string) => product.allergenTags.includes(tag) || ingredientTags.has(tag)

  // 1 + 2: declared allergies
  for (const allergy of profile.allergies) {
    const label = allergenLabel(allergy.tag)
    if (containsTag(allergy.tag)) {
      consider('avoid', `Contains ${label.toLowerCase()} — your allergy`)
    } else if (product.mayContainTags.includes(allergy.tag)) {
      consider('caution', `May contain traces of ${label.toLowerCase()} — your allergy`)
    }
  }

  // 3: conservative failure — unknown ingredient + any declared allergy
  if (profile.allergies.length > 0) {
    const unknown = product.ingredients.find((i) => i.riskClass === 'unknown')
    if (unknown) {
      consider(
        'caution',
        `${unknown.name} can't be fully verified — checked because of your allergies`,
      )
    }
  }

  // 4: custom avoid list (case-insensitive substring over ingredient + product names)
  for (const term of profile.customAvoid) {
    const needle = term.trim().toLowerCase()
    if (!needle) continue
    const hit =
      product.ingredients.some((i) => i.name.toLowerCase().includes(needle)) ||
      product.name.toLowerCase().includes(needle)
    if (hit) consider('avoid', `Contains ${term.trim()} — on your avoid list`)
  }

  // 5: intolerances
  for (const id of profile.intolerances) {
    const option = INTOLERANCE_OPTIONS.find((o) => o.id === id)
    if (!option) continue
    const hitTag = option.tags.find((tag) => containsTag(tag))
    if (hitTag) {
      consider('caution', `Contains ${allergenLabel(hitTag).toLowerCase()} — your ${option.label.toLowerCase()} intolerance`)
    }
  }

  // 6: diet patterns (placeholder heuristic — Phase 2 uses full taxonomy)
  for (const id of profile.dietPatterns) {
    const option = DIET_PATTERN_OPTIONS.find((o) => o.id === id)
    if (!option) continue
    const hitTag = option.conflictTags.find((tag) => containsTag(tag))
    if (hitTag) {
      consider('caution', `Contains ${allergenLabel(hitTag).toLowerCase()} — not ${option.label.toLowerCase()}`)
    }
  }

  return result
}

/* ---------------------------------------------------------------------------
 * Zustand store (persisted to localStorage)
 * ------------------------------------------------------------------------- */

interface DietaryProfileState extends VerdictInput {
  toggleAllergy: (tag: string) => void
  setAllergySeverity: (tag: string, severity: AllergySeverity) => void
  toggleIntolerance: (id: string) => void
  toggleDietPattern: (id: string) => void
  addCustomAvoid: (term: string) => void
  removeCustomAvoid: (term: string) => void
}

export const DIETARY_PROFILE_STORAGE_KEY = 'foodbuddy-dietary-profile'

export const useDietaryProfileStore = create<DietaryProfileState>()(
  persist(
    (set) => ({
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
    { name: DIETARY_PROFILE_STORAGE_KEY },
  ),
)
