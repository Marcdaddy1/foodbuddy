import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearLocalPersonalData, deleteAccount, exportMyData } from './account'
import { DIETARY_PROFILE_STORAGE_KEY } from '../stores/dietary-profile'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
  invoke: vi.fn(),
}))

vi.mock('./supabase', () => ({
  supabase: {
    auth: { getSession: mocks.getSession, signOut: mocks.signOut },
    functions: { invoke: mocks.invoke },
  },
  isSupabaseConfigured: true,
}))

const SESSION = {
  data: { session: { user: { id: 'user-1', email: 'marc@example.com' } } },
}
const NO_SESSION = { data: { session: null } }

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mocks.signOut.mockResolvedValue({ error: null })
})

describe('clearLocalPersonalData', () => {
  it('removes the persisted dietary profile', () => {
    localStorage.setItem(DIETARY_PROFILE_STORAGE_KEY, '{"state":{"allergies":[]}}')
    clearLocalPersonalData()
    expect(localStorage.getItem(DIETARY_PROFILE_STORAGE_KEY)).toBeNull()
  })
})

describe('deleteAccount', () => {
  it('refuses when there is no session', async () => {
    mocks.getSession.mockResolvedValue(NO_SESSION)
    const result = await deleteAccount()
    expect(result).toEqual({ ok: false, message: 'You are not signed in.' })
    expect(mocks.invoke).not.toHaveBeenCalled()
  })

  it('calls the edge function with no body — the server derives the user from the token', async () => {
    mocks.getSession.mockResolvedValue(SESSION)
    mocks.invoke.mockResolvedValue({ data: { ok: true }, error: null })

    await deleteAccount()

    expect(mocks.invoke).toHaveBeenCalledWith('delete-account', { method: 'POST' })
    const [, options] = mocks.invoke.mock.calls[0]
    // A user id in the payload would mean the client picks the victim.
    expect(JSON.stringify(options)).not.toContain('user-1')
  })

  it('clears local personal data and signs out on success', async () => {
    localStorage.setItem(DIETARY_PROFILE_STORAGE_KEY, '{"state":{"allergies":["en:milk"]}}')
    mocks.getSession.mockResolvedValue(SESSION)
    mocks.invoke.mockResolvedValue({ data: { ok: true }, error: null })

    const result = await deleteAccount()

    expect(result.ok).toBe(true)
    expect(localStorage.getItem(DIETARY_PROFILE_STORAGE_KEY)).toBeNull()
    expect(mocks.signOut).toHaveBeenCalled()
  })

  it('KEEPS local data when the server deletion fails', async () => {
    // Wiping the profile after a failed delete would destroy the user's
    // allergy settings while their account still exists — data loss on an
    // error path, and for allergy data that is a safety problem.
    const stored = '{"state":{"allergies":["en:peanuts"]}}'
    localStorage.setItem(DIETARY_PROFILE_STORAGE_KEY, stored)
    mocks.getSession.mockResolvedValue(SESSION)
    mocks.invoke.mockResolvedValue({ data: null, error: { message: 'boom' } })

    const result = await deleteAccount()

    expect(result.ok).toBe(false)
    expect(localStorage.getItem(DIETARY_PROFILE_STORAGE_KEY)).toBe(stored)
    expect(mocks.signOut).not.toHaveBeenCalled()
  })

  it('surfaces a usable message when the network throws', async () => {
    mocks.getSession.mockResolvedValue(SESSION)
    mocks.invoke.mockRejectedValue(new Error('offline'))

    const result = await deleteAccount()

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toMatch(/connection/i)
  })
})

describe('exportMyData', () => {
  it('refuses when there is no session', async () => {
    mocks.getSession.mockResolvedValue(NO_SESSION)
    const result = await exportMyData()
    expect(result.ok).toBe(false)
  })
})
