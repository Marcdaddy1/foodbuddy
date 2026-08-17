/**
 * delete-account — Supabase Edge Function (Deno).
 *
 * Permanently deletes the CALLING user's account and every row of personal data
 * attached to it. Required by Google Play's User Data policy (enforced since
 * 15 April 2024) and by UK/EU GDPR Article 17.
 *
 * POST with `Authorization: Bearer <user access token>`. No request body.
 *
 * SECURITY — the single rule this function exists to enforce:
 *   The user id is derived ONLY from the verified access token. It is never
 *   read from the body, a query param, or a header. Accepting a caller-supplied
 *   id here would let any authenticated user delete any other account, which is
 *   why this function takes no input at all.
 *
 * Deploy with verify_jwt = true so the platform rejects unauthenticated calls
 * before this code runs; the getUser() check below is the second line of
 * defence, not the first.
 *
 * Data removal relies on ON DELETE CASCADE from auth.users:
 *   auth.users -> profiles -> dietary_profiles
 *              -> scan_history, favorites, list_members
 *              -> lists -> list_items
 * Catalog tables (products, ingredients) hold no personal data and are
 * untouched. scan_history.product_id is ON DELETE SET NULL against products,
 * which is irrelevant here — the whole row goes.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
}

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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    console.error('delete-account: missing environment configuration')
    return jsonResponse(500, { ok: false, error: 'server misconfigured' })
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return jsonResponse(401, { ok: false, error: 'missing bearer token' })
  }

  // Resolve the caller from their own token. This is the ONLY source of the
  // user id — see the security note above.
  const asCaller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData, error: userError } = await asCaller.auth.getUser()
  const user = userData?.user
  if (userError || !user) {
    return jsonResponse(401, { ok: false, error: 'invalid or expired session' })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Deleting the auth user cascades every owned row away. Not a soft delete:
  // Play explicitly rejects deactivation, freezing, or disabling as a
  // substitute for deletion.
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)

  if (deleteError) {
    // Never log the user's email or any profile content — that would copy
    // sensitive data into logs, which CLAUDE.md rule 3 forbids. The id alone
    // is enough to investigate.
    console.error(
      `delete-account: failed for user ${user.id}: ${deleteError.message}`,
    )
    return jsonResponse(500, { ok: false, error: 'deletion failed' })
  }

  console.log(`delete-account: deleted user ${user.id}`)
  return jsonResponse(200, { ok: true })
})
