/**
 * Open Food Facts API v2 client.
 *
 * OFF rate limits product lookups per client (roughly 100 req/min) — so this
 * client NEVER retry-storms: at most ONE retry, only for transient
 * network/5xx failures, with a short backoff. 404s and parse failures are
 * never retried.
 */
import { normalizeOffProduct, offResponseSchema } from './normalize'
import type { NormalizedProduct } from './types'

const OFF_FIELDS =
  'code,product_name,brands,categories_tags,ingredients_text,ingredients,nutriments,nova_group,additives_tags,allergens_tags,traces_tags,last_modified_t'

export function offProductUrl(barcode: string): string {
  return `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${OFF_FIELDS}`
}

/** Barcode isn't in Open Food Facts (HTTP 404 or status=0). */
export class OffNotFoundError extends Error {
  constructor(barcode: string) {
    super(`Product ${barcode} not found in Open Food Facts`)
    this.name = 'OffNotFoundError'
  }
}

/** OFF responded, but with a payload we couldn't parse — distinct from network failure. */
export class OffParseError extends Error {
  constructor(barcode: string, detail: string) {
    super(`Unparseable Open Food Facts response for ${barcode}: ${detail}`)
    this.name = 'OffParseError'
  }
}

/** Network failure or OFF server error (offline, timeout, 5xx). */
export class OffNetworkError extends Error {
  constructor(barcode: string, detail: string) {
    super(`Open Food Facts unreachable for ${barcode}: ${detail}`)
    this.name = 'OffNetworkError'
  }
}

export interface OffFetchResult {
  product: NormalizedProduct
  /** Raw OFF product JSON — forwarded verbatim to the cache-product edge function. */
  raw: unknown
}

interface FetchOffOptions {
  signal?: AbortSignal
  /** Injectable for tests. */
  fetchImpl?: typeof fetch
  /** Injectable backoff for tests (default 600 ms). */
  retryDelayMs?: number
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

async function fetchOnce(
  barcode: string,
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
): Promise<Response> {
  try {
    return await fetchImpl(offProductUrl(barcode), {
      signal,
      headers: { Accept: 'application/json' },
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new OffNetworkError(barcode, err instanceof Error ? err.message : String(err))
  }
}

/**
 * Fetch + validate + normalize one product from OFF.
 *
 * Throws:
 * - OffNotFoundError  — barcode unknown to OFF
 * - OffParseError     — malformed/unexpected payload
 * - OffNetworkError   — offline / OFF down (after a single backoff retry)
 */
export async function fetchOffProduct(
  barcode: string,
  options: FetchOffOptions = {},
): Promise<OffFetchResult> {
  const fetchImpl = options.fetchImpl ?? fetch
  const retryDelayMs = options.retryDelayMs ?? 600

  let response: Response
  try {
    response = await fetchOnce(barcode, fetchImpl, options.signal)
    if (response.status >= 500) {
      throw new OffNetworkError(barcode, `HTTP ${response.status}`)
    }
  } catch (err) {
    if (!(err instanceof OffNetworkError)) throw err
    // Single retry with backoff — never more (OFF rate limits are per-user).
    await sleep(retryDelayMs)
    response = await fetchOnce(barcode, fetchImpl, options.signal)
    if (response.status >= 500) {
      throw new OffNetworkError(barcode, `HTTP ${response.status} after retry`)
    }
  }

  if (response.status === 404) throw new OffNotFoundError(barcode)
  if (!response.ok) throw new OffParseError(barcode, `unexpected HTTP ${response.status}`)

  let json: unknown
  try {
    json = await response.json()
  } catch {
    throw new OffParseError(barcode, 'response body is not valid JSON')
  }

  const parsed = offResponseSchema.safeParse(json)
  if (!parsed.success) {
    throw new OffParseError(barcode, parsed.error.issues.map((i) => i.message).join('; '))
  }

  const status = Number(parsed.data.status ?? 1)
  if (status === 0 || !parsed.data.product) throw new OffNotFoundError(barcode)

  const rawProduct = (json as { product?: unknown }).product
  return {
    product: normalizeOffProduct(barcode, parsed.data.product, new Date().toISOString()),
    raw: rawProduct,
  }
}
