import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AnalyticsConsent = 'unset' | 'granted' | 'denied'

interface ConsentState {
  analyticsConsent: AnalyticsConsent
  grant: () => void
  deny: () => void
}

export const CONSENT_STORAGE_KEY = 'foodbuddy-consent'

/**
 * Analytics consent, persisted to localStorage. Telemetry (PostHog) must
 * check this store and only initialize when consent === 'granted'.
 */
export const useConsentStore = create<ConsentState>()(
  persist(
    (set) => ({
      analyticsConsent: 'unset',
      grant: () => set({ analyticsConsent: 'granted' }),
      deny: () => set({ analyticsConsent: 'denied' }),
    }),
    { name: CONSENT_STORAGE_KEY },
  ),
)
