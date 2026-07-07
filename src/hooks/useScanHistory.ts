/**
 * Scan history — real Supabase rows when signed in.
 *
 * PRIVACY (CLAUDE.md hard rule #3): verdicts derive from the user's sensitive
 * dietary profile. Never log rows or send them to analytics; failures are
 * ignored silently by design.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Verdict } from '../stores/dietary-profile'

export interface ScanHistoryEntry {
  id: string
  barcode: string
  scannedAt: Date
  verdict: Verdict | null
  score: number | null
  productName: string | null
  brand: string | null
}

const VERDICTS: ReadonlyArray<Verdict> = ['safe', 'caution', 'avoid']

function asVerdict(value: string | null): Verdict | null {
  return VERDICTS.includes(value as Verdict) ? (value as Verdict) : null
}

export const SCAN_HISTORY_QUERY_KEY = ['scan-history'] as const

async function fetchScanHistory(userId: string, limit: number): Promise<ScanHistoryEntry[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('scan_history')
    .select('id, barcode, scanned_at, verdict, score, products(name, brand)')
    .eq('user_id', userId)
    .order('scanned_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: row.id,
    barcode: row.barcode,
    scannedAt: new Date(row.scanned_at),
    verdict: asVerdict(row.verdict),
    score: row.score,
    productName: row.products?.name ?? null,
    brand: row.products?.brand ?? null,
  }))
}

/** Real scan history for the signed-in user. Disabled while signed out. */
export function useScanHistory(userId: string | undefined, limit = 50) {
  return useQuery<ScanHistoryEntry[]>({
    queryKey: [...SCAN_HISTORY_QUERY_KEY, userId, limit],
    queryFn: () => fetchScanHistory(userId as string, limit),
    enabled: Boolean(userId) && supabase !== null,
    staleTime: 30_000,
  })
}

export interface RecordScanInput {
  userId: string
  barcode: string
  productId: string | null
  verdict: Verdict
  score: number
  ruleVersion: string
}

/**
 * Persist one scan_history row. Failures are swallowed silently — recording
 * history must never break the verdict screen.
 */
export async function recordScan(input: RecordScanInput): Promise<boolean> {
  if (!supabase) return false
  try {
    const { error } = await supabase.from('scan_history').insert({
      user_id: input.userId,
      barcode: input.barcode,
      product_id: input.productId,
      verdict: input.verdict,
      score: input.score,
      rule_version: input.ruleVersion,
    })
    return !error
  } catch {
    return false
  }
}

/** Invalidate cached history lists after a new scan lands. */
export function useInvalidateScanHistory() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: SCAN_HISTORY_QUERY_KEY })
  }
}
