/**
 * Product lookup hook — resolves a barcode to a NormalizedProduct.
 *
 * Resolution order:
 *   (a) Supabase `products` cache, when off_last_fetched_at is within 30 days
 *   (b) Open Food Facts direct; on success, fire-and-forget POST to the
 *       cache-product edge function (non-blocking, errors only console.warn)
 *   (c) stale Supabase row as offline / OFF-down fallback (marked stale)
 *
 * Not-found and parse/network errors are distinct: components check
 * `error instanceof ProductNotFoundError` for the friendly not-found state.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import {
  fetchOffProduct,
  normalizedFromProductRow,
  OffNotFoundError,
  type NormalizedProduct,
  type ProductRow,
} from '../lib/off'

/** Barcode has no product — neither in OFF nor in our cache. */
export class ProductNotFoundError extends Error {
  constructor(barcode: string) {
    super(`No product found for barcode ${barcode}`)
    this.name = 'ProductNotFoundError'
  }
}

export const CACHE_FRESH_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

/** EAN-8 … EAN-14 (incl. UPC-A/EAN-13). */
export function isValidBarcode(barcode: string): boolean {
  return /^\d{8,14}$/.test(barcode)
}

function isCacheFresh(row: ProductRow, now: number): boolean {
  if (!row.off_last_fetched_at) return false
  const fetched = Date.parse(row.off_last_fetched_at)
  return Number.isFinite(fetched) && now - fetched < CACHE_FRESH_MS
}

async function readCachedRow(barcode: string): Promise<ProductRow | null> {
  if (!supabase) return null
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('barcode', barcode)
      .maybeSingle()
    if (error) {
      console.warn('[foodbuddy] products cache read failed:', error.message)
      return null
    }
    return data
  } catch {
    return null // cache unreachable — fall through to OFF
  }
}

/**
 * Fire-and-forget write-through to the cache-product edge function.
 * MUST never block or fail the lookup — errors are swallowed with a warn
 * (the function may simply not be deployed yet).
 */
function cacheProductNonBlocking(barcode: string, raw: unknown): void {
  if (!supabase || raw === undefined) return
  supabase.functions
    .invoke('cache-product', { body: { barcode, product: raw } })
    .then(({ error }) => {
      if (error) console.warn('[foodbuddy] cache-product failed (non-blocking):', error.message)
    })
    .catch((err: unknown) => {
      console.warn('[foodbuddy] cache-product failed (non-blocking):', err)
    })
}

export async function lookupProduct(barcode: string): Promise<NormalizedProduct> {
  if (!isValidBarcode(barcode)) throw new ProductNotFoundError(barcode)

  // (a) fresh Supabase cache
  const cached = await readCachedRow(barcode)
  if (cached && isCacheFresh(cached, Date.now())) {
    return normalizedFromProductRow(cached, false)
  }

  // (b) Open Food Facts direct
  try {
    const { product, raw } = await fetchOffProduct(barcode)
    cacheProductNonBlocking(barcode, raw)
    return product
  } catch (err) {
    // (c) stale cache fallback when OFF is down/unreachable
    if (cached) return normalizedFromProductRow(cached, true)
    if (err instanceof OffNotFoundError) throw new ProductNotFoundError(barcode)
    throw err
  }
}

export function useProductLookup(barcode: string): UseQueryResult<NormalizedProduct> {
  return useQuery<NormalizedProduct>({
    queryKey: ['product', barcode],
    queryFn: () => lookupProduct(barcode),
    // The OFF client already does its own single backoff retry — never
    // retry-storm OFF from the query layer, and never retry a not-found.
    retry: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  })
}
