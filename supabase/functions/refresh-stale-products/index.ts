/**
 * refresh-stale-products — Supabase Edge Function (Deno).
 *
 * Re-fetches the most-stale catalog rows from Open Food Facts so the device
 * cache stays warm. Without it, every seeded product ages past the client's
 * 30-day freshness window and each scan pays a full OFF round-trip — defeating
 * the point of seeding and pushing users toward OFF's per-user rate limits in a
 * supermarket session.
 *
 * POST with header `x-cron-secret: <secret>`. Optional body `{"batch": n}`.
 *
 * AUTH: deployed with verify_jwt = false (pg_cron has no user session), so the
 * shared secret IS the gate. It lives in `private_config` — RLS on, no policies,
 * so only the service role can read it. Compared in constant time.
 *
 * OFF COURTESY: OFF is volunteer-run. Requests are paced, the batch is capped, a
 * descriptive User-Agent is sent, and nothing retries in a loop.
 *
 * Scheduled nightly at 03:00 by migration 0005 via pg_cron + pg_net.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'

const USER_AGENT = 'FoodBuddy/1.0 (refresh job; marcdaddy.business@gmail.com)'
const OFF_FIELDS =
  'code,product_name,brands,categories_tags,ingredients_text,nutriments,nova_group,additives_tags,allergens_tags,traces_tags'

/** Below the client's 30-day window, so rows renew before a user ever sees stale data. */
const STALE_AFTER_DAYS = 21

/**
 * OFF rate-limits product reads at roughly 15/min. Measured directly: at 1.5s
 * pacing (40/min) it returned 429 for 15 of 40 requests AND began serving
 * spurious 404s for known-good barcodes. 4.5s pacing keeps us near 13/min,
 * under the limit, so nothing is wasted and no good row gets mis-stamped.
 * 30 x 4.5s ~= 135s, inside the function wall clock.
 */
const DEFAULT_BATCH = 30
const PACING_MS = 4500

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Length-independent comparison so a wrong secret leaks nothing via timing. */
function secretsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

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

const TAXONOMY_TAG_RE = /^[a-z]{2,3}:/
const stripLocale = (tag: string) => tag.replace(/^[a-z]{2,3}:/, '')
const NUTRIMENT_KEYS = [
  'energy-kcal_100g', 'energy_100g', 'energy-kj_100g', 'fat_100g',
  'saturated-fat_100g', 'carbohydrates_100g', 'sugars_100g', 'proteins_100g',
  'salt_100g', 'sodium_100g', 'fiber_100g',
]

/**
 * Must stay identical to `cache-product`'s normalisation, or a refreshed row
 * would score differently from a freshly-cached one. Additives/traces ride
 * inside `nutriments` under reserved keys — the products table has no columns
 * for them yet.
 */
function normalizeForUpsert(barcode: string, raw: Record<string, unknown>) {
  const nr =
    raw.nutriments !== null && typeof raw.nutriments === 'object' && !Array.isArray(raw.nutriments)
      ? (raw.nutriments as Record<string, unknown>)
      : {}
  const nutriments: Record<string, unknown> = {}
  for (const key of NUTRIMENT_KEYS) {
    const v = nr[key]
    if (typeof v === 'number' && Number.isFinite(v)) nutriments[key] = v
    else if (typeof v === 'string' && Number.isFinite(Number(v))) nutriments[key] = Number(v)
  }
  nutriments['_additives_tags'] = asStringArray(raw.additives_tags).filter((t) => TAXONOMY_TAG_RE.test(t))
  nutriments['_traces_tags'] = asStringArray(raw.traces_tags).filter((t) => TAXONOMY_TAG_RE.test(t))

  const brands = asString(raw.brands)
  return {
    barcode,
    name: asString(raw.product_name),
    brand: brands ? (brands.split(',')[0]?.trim() ?? null) : null,
    categories: asStringArray(raw.categories_tags).map(stripLocale).slice(0, 50),
    ingredients_raw: asString(raw.ingredients_text)?.slice(0, 8000) ?? null,
    nutriments,
    nova_group: asNova(raw.nova_group),
    allergen_tags: asStringArray(raw.allergens_tags).filter((t) => TAXONOMY_TAG_RE.test(t)),
    off_last_fetched_at: new Date().toISOString(),
    data_source: 'openfoodfacts',
  }
}

/**
 * Stamps a row as checked so it leaves the most-stale queue.
 *
 * This is the fix for the batch-poisoning bug: originally ANY failure left the
 * row unstamped, so permanently-dead barcodes stayed the most-stale rows and
 * were re-picked first on every run — 14 of every 40 slots were burned on the
 * same dead barcodes, forever. Only genuinely transient failures may go
 * unstamped now.
 */
async function touch(admin: ReturnType<typeof createClient>, barcode: string): Promise<void> {
  await admin
    .from('products')
    .update({ off_last_fetched_at: new Date().toISOString() })
    .eq('barcode', barcode)
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function handle(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method not allowed' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return json(500, { ok: false, error: 'server misconfigured' })

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

  // --- Gate ---------------------------------------------------------------
  const presented = req.headers.get('x-cron-secret') ?? ''
  const { data: secretRow, error: secretError } = await admin
    .from('private_config')
    .select('value')
    .eq('key', 'refresh_cron_secret')
    .maybeSingle()
  if (secretError || !secretRow?.value) return json(500, { ok: false, error: 'server misconfigured' })
  if (!secretsMatch(presented, secretRow.value as string)) {
    return json(401, { ok: false, error: 'unauthorized' })
  }

  // --- Batch size ---------------------------------------------------------
  let batch = DEFAULT_BATCH
  try {
    const raw = await req.text()
    if (raw) {
      const body = JSON.parse(raw) as { batch?: unknown }
      if (typeof body?.batch === 'number' && body.batch > 0) {
        batch = Math.min(Math.floor(body.batch), 100)
      }
    }
  } catch {
    // No body, or unparseable — the default is fine.
  }

  // NOTE: a PostgREST `.or()` with an ISO timestamp malformed the query and
  // crashed the isolate (opaque 502, no log). A plain `.lt()` is equivalent
  // here because off_last_fetched_at is NOT NULL in practice for seeded rows.
  const cutoff = new Date(Date.now() - STALE_AFTER_DAYS * 86400000).toISOString()
  const { data: stale, error: selectError } = await admin
    .from('products')
    .select('barcode')
    .lt('off_last_fetched_at', cutoff)
    .order('off_last_fetched_at', { ascending: true })
    .limit(batch)

  if (selectError) return json(500, { ok: false, error: 'select failed', detail: selectError.message })
  if (!stale || stale.length === 0) {
    return json(200, { ok: true, refreshed: 0, not_found: 0, failed: 0, remaining_stale: 0, note: 'catalog fresh' })
  }

  // --- Refresh ------------------------------------------------------------
  let refreshed = 0
  let failed = 0
  let notFound = 0
  let throttled = false

  for (let i = 0; i < stale.length; i++) {
    const barcode = String((stale[i] as { barcode: string }).barcode)
    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${OFF_FIELDS}`,
        { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } },
      )

      if (res.status === 404) {
        // Withdrawn from OFF. Permanent — stamp it out of the queue.
        await touch(admin, barcode)
        notFound++
      } else if (res.status === 429) {
        // Throttled. Abandon the run immediately: continuing would waste
        // requests, and OFF starts returning spurious 404s under pressure —
        // which the 404 branch would wrongly treat as permanent and stamp out.
        failed++
        throttled = true
        break
      } else if (res.status >= 500) {
        // OFF is down. Transient: leave unstamped so it retries next run.
        failed++
      } else if (!res.ok) {
        // A 4xx that isn't 404 — malformed or rejected barcode. Never succeeds.
        await touch(admin, barcode)
        notFound++
      } else {
        let payload: { status?: number; product?: Record<string, unknown> } | null = null
        try {
          payload = (await res.json()) as { status?: number; product?: Record<string, unknown> }
        } catch {
          // HTTP 200 with a non-JSON body — OFF serves an HTML error page under
          // load. Transient.
          failed++
        }
        if (payload) {
          if (payload.status === 1 && payload.product) {
            const { error } = await admin
              .from('products')
              .upsert(normalizeForUpsert(barcode, payload.product), { onConflict: 'barcode' })
            if (error) {
              // Our own write failed — transient, worth retrying.
              console.error('refresh upsert ' + barcode + ': ' + error.message)
              failed++
            } else {
              refreshed++
            }
          } else {
            // OFF answered cleanly and has no usable product for this barcode.
            // Permanent as far as we can tell — stamp it out of the queue.
            await touch(admin, barcode)
            notFound++
          }
        }
      }
    } catch (err) {
      // Network-level throw: transient.
      console.error('refresh ' + barcode + ': ' + (err instanceof Error ? err.message : String(err)))
      failed++
    }

    if (i < stale.length - 1) await sleep(PACING_MS)
  }

  const { count } = await admin
    .from('products')
    .select('barcode', { count: 'exact', head: true })
    .lt('off_last_fetched_at', cutoff)

  console.log(
    `refresh: ${refreshed} refreshed, ${notFound} gone, ${failed} transient-fail${throttled ? ' (STOPPED: throttled by OFF)' : ''}, ${count ?? '?'} still stale`,
  )
  return json(200, { ok: true, refreshed, not_found: notFound, failed, throttled, remaining_stale: count ?? null })
}

Deno.serve(async (req) => {
  try {
    return await handle(req)
  } catch (err) {
    // Without this the isolate dies and the caller sees an opaque 502 with no
    // log line — which is exactly how the original .or() bug hid.
    const message = err instanceof Error ? err.name + ': ' + err.message : String(err)
    console.error('refresh: unhandled error: ' + message)
    return json(500, { ok: false, error: 'unhandled', detail: message })
  }
})
