import { beforeEach, describe, expect, it } from 'vitest'
import { CONSENT_STORAGE_KEY, useConsentStore } from './consent'

function persistedConsent(): string | undefined {
  const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY)
  if (!raw) return undefined
  const parsed = JSON.parse(raw) as { state?: { analyticsConsent?: string } }
  return parsed.state?.analyticsConsent
}

describe('consent store', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useConsentStore.setState({ analyticsConsent: 'unset' })
  })

  it('defaults to unset', () => {
    expect(useConsentStore.getState().analyticsConsent).toBe('unset')
  })

  it('grant() sets granted and persists to localStorage', () => {
    useConsentStore.getState().grant()
    expect(useConsentStore.getState().analyticsConsent).toBe('granted')
    expect(persistedConsent()).toBe('granted')
  })

  it('deny() sets denied and persists to localStorage', () => {
    useConsentStore.getState().deny()
    expect(useConsentStore.getState().analyticsConsent).toBe('denied')
    expect(persistedConsent()).toBe('denied')
  })

  it('a later decision overwrites the persisted value', () => {
    useConsentStore.getState().grant()
    useConsentStore.getState().deny()
    expect(useConsentStore.getState().analyticsConsent).toBe('denied')
    expect(persistedConsent()).toBe('denied')
  })
})
