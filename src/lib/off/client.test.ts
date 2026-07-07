import { describe, expect, it, vi } from 'vitest'
import { fetchOffProduct, OffNetworkError, OffNotFoundError, OffParseError } from './client'
import { OFF_NOT_FOUND, OFF_NUTELLA } from './__fixtures__/off-fixtures'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('fetchOffProduct', () => {
  it('normalizes a successful response and returns the raw product', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(OFF_NUTELLA))
    const { product, raw } = await fetchOffProduct('3017620422003', { fetchImpl })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain(
      'world.openfoodfacts.org/api/v2/product/3017620422003.json',
    )
    expect(product.name).toBe('Nutella')
    expect(raw).toEqual(OFF_NUTELLA.product)
  })

  it('throws OffNotFoundError on HTTP 404 without retrying', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(OFF_NOT_FOUND, 404))
    await expect(fetchOffProduct('0000000000000', { fetchImpl })).rejects.toBeInstanceOf(
      OffNotFoundError,
    )
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('throws OffNotFoundError on status=0 bodies', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(OFF_NOT_FOUND, 200))
    await expect(fetchOffProduct('0000000000000', { fetchImpl })).rejects.toBeInstanceOf(
      OffNotFoundError,
    )
  })

  it('throws OffParseError (not a network error) for malformed bodies', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response('<html>not json</html>', { status: 200 }))
    await expect(fetchOffProduct('3017620422003', { fetchImpl })).rejects.toBeInstanceOf(
      OffParseError,
    )
    expect(fetchImpl).toHaveBeenCalledTimes(1) // parse failures are never retried
  })

  it('retries exactly once on network failure, then succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(jsonResponse(OFF_NUTELLA))
    const { product } = await fetchOffProduct('3017620422003', { fetchImpl, retryDelayMs: 1 })
    expect(product.brand).toBe('Ferrero')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('gives up with OffNetworkError after a single retry (no retry storm)', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(
      fetchOffProduct('3017620422003', { fetchImpl, retryDelayMs: 1 }),
    ).rejects.toBeInstanceOf(OffNetworkError)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('treats 5xx as retryable network failure', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('oops', { status: 503 }))
      .mockResolvedValueOnce(jsonResponse(OFF_NUTELLA))
    const { product } = await fetchOffProduct('3017620422003', { fetchImpl, retryDelayMs: 1 })
    expect(product.name).toBe('Nutella')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
