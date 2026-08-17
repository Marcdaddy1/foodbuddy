/**
 * Account lifecycle: export my data (GDPR Art. 20) and delete my account
 * (GDPR Art. 17 + Google Play User Data policy).
 *
 * PRIVACY: an export contains the user's sensitive dietary data by definition.
 * It is assembled in memory and handed straight to the user — never logged,
 * never sent anywhere, never attached to a telemetry event.
 */
import { supabase } from './supabase'
import { DIETARY_PROFILE_STORAGE_KEY } from '../stores/dietary-profile'

export type AccountActionResult =
  | { ok: true }
  | { ok: false; message: string }

/**
 * Wipes locally persisted personal data. Called after deletion so nothing
 * sensitive survives on the device — a deleted account must not leave an
 * allergy profile sitting in localStorage for the next person to use the phone.
 */
export function clearLocalPersonalData(): void {
  try {
    localStorage.removeItem(DIETARY_PROFILE_STORAGE_KEY)
  } catch {
    // Private-mode / storage-disabled browsers: nothing persisted, nothing to clear.
  }
}

/**
 * Permanently deletes the signed-in user's account and all associated data,
 * then ends the local session.
 *
 * The server derives the account to delete from the caller's access token, so
 * there is no user id to pass and no way for this call to target anyone else.
 */
export async function deleteAccount(): Promise<AccountActionResult> {
  if (!supabase) {
    return { ok: false, message: 'Not connected to the server. Try again later.' }
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      return { ok: false, message: 'You are not signed in.' }
    }

    const { error } = await supabase.functions.invoke('delete-account', {
      method: 'POST',
    })

    if (error) {
      return {
        ok: false,
        message:
          'We could not delete your account just now. Check your connection and try again, or email support.',
      }
    }
  } catch {
    return {
      ok: false,
      message:
        'We could not reach the server. Check your connection and try again.',
    }
  }

  // The account is gone; the local session is now invalid regardless of whether
  // signOut() can reach the server, so failures here are not worth surfacing.
  clearLocalPersonalData()
  await supabase.auth.signOut().catch(() => undefined)

  return { ok: true }
}

/** Reads the device-local dietary profile for inclusion in a data export. */
function readLocalDietaryProfile(): unknown {
  try {
    const raw = localStorage.getItem(DIETARY_PROFILE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { state?: unknown }
    return parsed.state ?? null
  } catch {
    return null
  }
}

export interface ExportedData {
  exportedAt: string
  account: { id: string; email: string | null }
  profile: unknown
  dietaryProfile: unknown
  scanHistory: unknown[]
  favorites: unknown[]
  lists: unknown[]
  listItems: unknown[]
}

/**
 * Assembles everything the account owns into a single JSON object. Every query
 * runs as the user under RLS, so this can only ever return their own rows.
 */
export async function exportMyData(): Promise<
  { ok: true; data: ExportedData } | { ok: false; message: string }
> {
  if (!supabase) {
    return { ok: false, message: 'Not connected to the server. Try again later.' }
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      return { ok: false, message: 'You are not signed in.' }
    }

    const userId = session.user.id

    const [profile, dietary, history, favorites, lists] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('dietary_profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('scan_history').select('*').order('scanned_at', { ascending: false }),
      supabase.from('favorites').select('*'),
      supabase.from('lists').select('*'),
    ])

    const listIds = (lists.data ?? []).map((l) => l.id)
    const listItems = listIds.length
      ? await supabase.from('list_items').select('*').in('list_id', listIds)
      : { data: [] as unknown[] }

    return {
      ok: true,
      data: {
        exportedAt: new Date().toISOString(),
        account: { id: userId, email: session.user.email ?? null },
        profile: profile.data ?? null,
        // The dietary profile currently lives in localStorage, not in the
        // `dietary_profiles` table (server sync lands in Phase 2). Reading only
        // the table made the export silently omit the most sensitive category
        // it claims to cover, which would not satisfy GDPR Art. 20.
        dietaryProfile: dietary.data ?? readLocalDietaryProfile(),
        scanHistory: history.data ?? [],
        favorites: favorites.data ?? [],
        lists: lists.data ?? [],
        listItems: listItems.data ?? [],
      },
    }
  } catch {
    return { ok: false, message: 'Could not build your export. Try again.' }
  }
}

/**
 * Offers the export to the user as a file.
 *
 * Returns false when the browser/WebView blocks the download — Android
 * WebViews routinely swallow blob downloads — so the caller can fall back to
 * copy-to-clipboard rather than leaving the user with a button that silently
 * does nothing.
 */
export function downloadJson(filename: string, payload: unknown): boolean {
  try {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    // Revoke on the next tick so the download has taken the reference.
    setTimeout(() => URL.revokeObjectURL(url), 0)
    return true
  } catch {
    return false
  }
}
