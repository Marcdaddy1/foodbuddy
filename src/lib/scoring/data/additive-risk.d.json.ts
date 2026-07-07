/**
 * Type declaration for additive-risk.json (TS `allowArbitraryExtensions`
 * declaration-file convention: foo.json → foo.d.json.ts).
 *
 * Structural integrity of the JSON against this shape is enforced by a unit
 * test in ../engine.test.ts (TS trusts declaration files, so the test is the
 * real guard).
 */

export type AdditiveRiskClass =
  | 'high_concern'
  | 'moderate'
  | 'low'
  | 'no_concern'

export interface AdditiveRiskClassInfo {
  label: string
  /** Points removed from the 0–100 additive subscore per additive found. */
  deduction: number
  /** EFSA/FDA/IARC references backing this class assignment. */
  citations: string[]
}

export interface AdditiveRiskTable {
  version: string
  /** Deduction for additive codes not present in the table (conservative). */
  unknownDeduction: number
  classes: Record<AdditiveRiskClass, AdditiveRiskClassInfo>
  additives: Record<string, { name: string; class: AdditiveRiskClass }>
}

declare const table: AdditiveRiskTable
export default table
