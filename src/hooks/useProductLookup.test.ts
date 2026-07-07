/**
 * Resolution-order tests for lookupProduct:
 *   (a) fresh Supabase cache -> no OFF request
 *   (b) OFF direct -> fire-and-forget cache-product invoke
 *   (c) stale Supabase row as OFF-down fallback (marked stale)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { lookupProduct, ProductNotFoundError, isValidBarcode } from './useProductLookup'
import { OFF_NOT_FOUND, OFF_NUTELLA } from '../lib/off/__fixtures__/off-fixtures'
import type { ProductRow } from '../lib/off'

const mocks = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
  invoke: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: mocks.maybeSingle }),
      }),
    }),
    functions: { invoke: mocks.invoke },
  },
  isSupabaseConfigured: true,
}))

function row(offLastFetchedAt: string | null): ProductRow {
  return {
    id: 'a2c1e1de-0000-4000-8000-000000000001',
    barcode: '3017620422003',
    name: 'Nutella (cached)',
    brand: 'Ferrero',
    categories: ['spreads'],
    ingredients_raw: 'Sugar, palm oil, hazelnuts 13%.',
    nutriments: { 'sugars_100g': 56.3 },
    nova_group: 4,
    allergen_tags: ['en:milk', 'en:nuts', 'en:soybeans'],
    off_last_fetched_at: offLastFetchedAt,
    data_source: 'openfoodfacts',
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
  }
}

const FRESH = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // 1 day old
const STALE = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString() // 45 days old

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const fetchMock = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchMock)
  mocks.invoke.mockResolvedValue({ data: { ok: true }, error: null })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('lookupProduct resolution order', () => {
  it('(a) serves a fresh Supabase cache row WITHOUT calling Open Food Facts', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: row(FRESH), error: null })

    const product = await lookupProduct('3017620422003')

    expect(product.source).toBe('supabase-cache')
    expect(product.stale).toBe(false)
    expect(product.name).toBe('Nutella (cached)')
    expect(product.supabaseProductId).toBe('a2c1e1de-0000-4000-8000-000000000001')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.invoke).not.toHaveBeenCalled()
  })

  it('(b) goes to OFF when the cache is stale, and fires cache-product non-blocking', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: row(STALE), error: null })
    fetchMock.mockResolvedValue(jsonResponse(OFF_NUTELLA))

    const product = await lookupProduct('3017620422003')

    expect(product.source).toBe('off')
    expect(product.name).toBe('Nutella')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(mocks.invoke).toHaveBeenCalledWith('cache-product', {
      body: { barcode: '3017620422003', product: OFF_NUTELLA.product },
    })
  })

  it('(b) goes to OFF when there is no cache row at all', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null })
    fetchMock.mockResolvedValue(jsonResponse(OFF_NUTELLA))

    const product = await lookupProduct('3017620422003')
    expect(product.source).toBe('off')
    expect(product.supabaseProductId).toBeNull()
  })

  it('(b) a failing cache-product invoke never fails the lookup (console.warn only)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null })
    mocks.invoke.mockResolvedValue({ data: null, error: { message: 'not deployed' } })
    fetchMock.mockResolvedValue(jsonResponse(OFF_NUTELLA))

    const product = await lookupProduct('3017620422003')
    expect(product.source).toBe('off')
    await vi.waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('cache-product failed (non-blocking)'),
        'not deployed',
      )
    })
    warnSpy.mockRestore()
  })

  it('(c) falls back to the STALE cache row when OFF is unreachable', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: row(STALE), error: null })
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const product = await lookupProduct('3017620422003')

    expect(product.source).toBe('supabase-cache')
    expect(product.stale).toBe(true)
    expect(product.name).toBe('Nutella (cached)')
    expect(fetchMock).toHaveBeenCalledTimes(2) // single retry, then fallback
  }, 10_000)

  it('throws ProductNotFoundError when OFF 404s and no cache row exists', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null })
    fetchMock.mockResolvedValue(jsonResponse(OFF_NOT_FOUND, 404))

    await expect(lookupProduct('9999999999999')).rejects.toBeInstanceOf(ProductNotFoundError)
  })

  it('rejects malformed barcodes before making ANY request', async () => {
    await expect(lookupProduct('not-a-barcode')).rejects.toBeInstanceOf(ProductNotFoundError)
    expect(mocks.maybeSingle).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('isValidBarcode', () => {
  it('accepts EAN-8 through EAN-14 digits only', () => {
    expect(isValidBarcode('12345678')).toBe(true)
    expect(isValidBarcode('3017620422003')).toBe(true)
    expect(isValidBarcode('12345678901234')).toBe(true)
    expect(isValidBarcode('1234567')).toBe(false)
    expect(isValidBarcode('123456789012345')).toBe(false)
    expect(isValidBarcode('30176204ABC03')).toBe(false)
  })
})
