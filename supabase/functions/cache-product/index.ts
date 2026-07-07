/**
 * cache-product — Supabase Edge Function (Deno).
 *
 * POST { barcode: string, product: <raw OFF product JSON> }
 * Re-normalizes the OFF payload SERVER-SIDE (never trusts client mapping) and
 * upserts it into public.products via the service role, setting
 * off_last_fetched_at = now(). Returns { ok: true }.
 *
 * Deploy note: the FoodBuddy client calls this with the publishable (non-JWT)
 * API key via supabase.functions.invoke — deploy with --no-verify-jwt
 * (validation below: method, size cap, barcode format, payload shape,
 * naive per-IP rate limit).
 *
 * Rate limiting is a BEST-EFFORT in-memory limiter: each function instance
 * keeps its own counters, instances scale/recycle freely, so this only blunts
 * bursts from a single client against one instance. Real abuse protection
 * belongs at the platform/WAF layer.
 *
 * The products table has no additive/traces columns, so OFF additives_tags
 * and traces_tags are stashed inside the nutriments jsonb under reserved
 * "_additives_tags" / "_traces_tags" keys — the client normalizer
 * (src/lib/off/normalize.ts) reads them back so scores/verdicts are identical
 * on the cache-hit path. A dedicated migration is the proper long-term fix.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
}

const MAX_BODY_BYTES = 100 * 1024 // 100 KB
const BARCODE_RE = /^\d{8,14}$/

/* ---------------------------------------------------------------------------
 * Naive in-memory per-IP rate limit (best-effort, see header comment)
 * ------------------------------------------------------------------------- */

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 30
const rateBuckets = new Map<string, { count: number; windowStart: number }>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const bucket = rateBuckets.get(ip)
  if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateBuckets.set(ip, { count: 1, windowStart: now })
    return false
  }
  bucket.count += 1
  if (rateBuckets.size > 10_000) rateBuckets.clear() // memory guard
  return bucket.count > RATE_LIMIT_MAX
}

/* ---------------------------------------------------------------------------
 * Server-side OFF normalization (independent of the client's mapping)
 * ------------------------------------------------------------------------- */

function asString(v: unknown): string | null {
  if (typeof v === 'string') {
    const s = v.trim()
    return s.length > 0 ? s : null
  }
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return null
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return [...new Set(v.filter((t): t is string => typeof t === 'string' && t.length > 0))]
}

function asNova(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return n === 1 || n === 2 || n === 3 || n === 4 ? n : null
}

function stripLocale(tag: string): string {
  return tag.replace(/^[a-z]{2,3}:/, '')
}

const TAXONOMY_TAG_RE = /^[a-z]{2,3}:/

/** Whitelist of per-100g nutriment keys we persist (keeps rows small). */
const NUTRIMENT_KEYS = [
  'energy-kcal_100g',
  'energy_100g',
  'energy-kj_100g',
  'fat_100g',
  'saturated-fat_100g',
  'carbohydrates_100g',
  'sugars_100g',
  'proteins_100g',
  'salt_100g',
  'sodium_100g',
  'fiber_100g',
] as const

interface ProductUpsert {
  barcode: string
  name: string | null
  brand: string | null
  categories: string[]
  ingredients_raw: string | null
  nutriments: Record<string, unknown>
  nova_group: number | null
  allergen_tags: string[]
  off_last_fetched_at: string
  data_source: 'openfoodfacts'
}

function normalizeForUpsert(barcode: string, raw: Record<string, unknown>): ProductUpsert {
  const nutrimentsRaw =
    raw.nutriments !== null && typeof raw.nutriments === 'object' && !Array.isArray(raw.nutriments)
      ? (raw.nutriments as Record<string, unknown>)
      : {}

  const nutriments: Record<string, unknown> = {}
  for (const key of NUTRIMENT_KEYS) {
    const v = nutrimentsRaw[key]
    if (typeof v === 'number' && Number.isFinite(v)) nutriments[key] = v
    else if (typeof v === 'string' && Number.isFinite(Number(v))) nutriments[key] = Number(v)
  }
  // Reserved app metadata keys (no dedicated columns yet — see header comment).
  nutriments['_additives_tags'] = asStringArray(raw.additives_tags).filter((t) =>
    TAXONOMY_TAG_RE.test(t),
  )
  nutriments['_traces_tags'] = asStringArray(raw.traces_tags).filter((t) =>
    TAXONOMY_TAG_RE.test(t),
  )

  const brands = asString(raw.brands)

  return {
    barcode,
    name: asString(raw.product_name),
    brand: brands ? (brands.split(',')[0]?.trim() ?? null) : null,
    categories: asStringArray(raw.categories_tags).map(stripLocale).slice(0, 50),
    ingredients_raw: asString(raw.ingredients_text)?.slice(0, 8_000) ?? null,
    nutriments,
    nova_group: asNova(raw.nova_group),
    allergen_tags: asStringArray(raw.allergens_tags).filter((t) => TAXONOMY_TAG_RE.test(t)),
    off_last_fetched_at: new Date().toISOString(),
    data_source: 'openfoodfacts',
  }
}

/* ---------------------------------------------------------------------------
 * Handler
 * ------------------------------------------------------------------------- */

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'method not allowed' })
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('cf-connecting-ip') ??
    'unknown'
  if (isRateLimited(ip)) {
    return jsonResponse(429, { ok: false, error: 'rate limit exceeded — try again shortly' })
  }

  const contentLength = Number(req.headers.get('content-length') ?? '0')
  if (contentLength > MAX_BODY_BYTES) {
    return jsonResponse(413, { ok: false, error: 'payload too large (max 100 KB)' })
  }

  let bodyText: string
  try {
    bodyText = await req.text()
  } catch {
    return jsonResponse(400, { ok: false, error: 'unreadable request body' })
  }
  if (bodyText.length > MAX_BODY_BYTES) {
    return jsonResponse(413, { ok: false, error: 'payload too large (max 100 KB)' })
  }

  let body: unknown
  try {
    body = JSON.parse(bodyText)
  } catch {
    return jsonResponse(400, { ok: false, error: 'invalid JSON' })
  }

  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return jsonResponse(400, { ok: false, error: 'body must be an object' })
  }
  const { barcode, product } = body as { barcode?: unknown; product?: unknown }

  if (typeof barcode !== 'string' || !BARCODE_RE.test(barcode)) {
    return jsonResponse(400, { ok: false, error: 'barcode must be 8-14 digits' })
  }
  if (product === null || typeof product !== 'object' || Array.isArray(product)) {
    return jsonResponse(400, { ok: false, error: 'product must be the raw OFF product object' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { ok: false, error: 'server misconfigured' })
  }

  const row = normalizeForUpsert(barcode, product as Record<string, unknown>)

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })
  const { error } = await admin.from('products').upsert(row, { onConflict: 'barcode' })
  if (error) {
    console.error('cache-product upsert failed:', error.message)
    return jsonResponse(500, { ok: false, error: 'upsert failed' })
  }

  return jsonResponse(200, { ok: true })
})
