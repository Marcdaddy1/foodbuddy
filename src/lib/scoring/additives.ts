/**
 * Additive subscore (0–100) — driven by the risk table in
 * ./data/additive-risk.json (class assignments + deductions + citations).
 *
 * Scoring: start at 100, deduct per DISTINCT resolved additive by risk
 * class, floor at 0. Additives not in the table earn a small conservative
 * deduction (`unknownDeduction`). Sub-variant tags (en:e322i, en:e450i,
 * en:e500ii) resolve to their parent code so the same substance listed twice
 * is only counted once.
 */

import type { ScoreFlag } from './types'
import riskTable from './data/additive-risk.json'

export interface AdditiveAssessment {
  /** 0–100, higher = better. */
  subscore: number
  flags: ScoreFlag[]
}

/** "en:E322i" → "e322i". */
function normalizeAdditiveTag(tag: string): string {
  const lower = tag.toLowerCase().trim()
  const colon = lower.lastIndexOf(':')
  return colon === -1 ? lower : lower.slice(colon + 1)
}

/**
 * Resolve a normalized tag to a table key: exact match first, then the code
 * with its variant letter (e472e), then the bare numeric code (e500ii →
 * e500). Returns null when the code is not in the table (unknown additive).
 */
export function resolveAdditiveCode(normalized: string): string | null {
  if (normalized in riskTable.additives) return normalized
  const withLetter = /^e\d{3,4}[a-z]?/.exec(normalized)?.[0]
  if (withLetter && withLetter in riskTable.additives) return withLetter
  const bare = /^e\d{3,4}/.exec(normalized)?.[0]
  if (bare && bare in riskTable.additives) return bare
  return null
}

export function assessAdditives(additiveTags: readonly string[]): AdditiveAssessment {
  // Dedupe by resolved identity so en:e322 + en:e322i count once.
  const known = new Set<string>()
  const unknown = new Set<string>()
  for (const tag of additiveTags) {
    const normalized = normalizeAdditiveTag(tag)
    if (normalized.length === 0) continue
    const resolved = resolveAdditiveCode(normalized)
    if (resolved !== null) known.add(resolved)
    else unknown.add(normalized)
  }

  let deduction = unknown.size * riskTable.unknownDeduction
  const flags: ScoreFlag[] = []

  // Iterate in sorted order so flag order is deterministic regardless of
  // the order OFF happens to list the tags in.
  for (const code of [...known].sort()) {
    const entry = riskTable.additives[code]
    deduction += riskTable.classes[entry.class].deduction
    if (entry.class === 'high_concern') {
      flags.push({
        tag: `additive-high-concern:${code}`,
        label: `Contains ${entry.name} (${code.toUpperCase()})`,
        severity: 'high',
      })
    } else if (entry.class === 'moderate') {
      flags.push({
        tag: `additive-moderate:${code}`,
        label: `Contains ${entry.name} (${code.toUpperCase()})`,
        severity: 'warn',
      })
    }
  }

  if (unknown.size > 0) {
    flags.push({
      tag: 'additives-unrecognized',
      label:
        unknown.size === 1
          ? '1 unrecognized additive'
          : `${unknown.size} unrecognized additives`,
      severity: 'info',
    })
  }

  return { subscore: Math.max(0, 100 - deduction), flags }
}
