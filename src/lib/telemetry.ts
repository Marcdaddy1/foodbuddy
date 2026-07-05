/**
 * Consent-gated telemetry.
 *
 * ============================================================================
 * IMPORTANT — PRIVACY RULE (see CLAUDE.md hard rule #3):
 * Dietary/allergy data is sensitive health data and must NEVER be sent in
 * analytics payloads, Sentry events, logs, or any telemetry. Scrub any
 * profile/verdict inputs before calling capture(). If an event needs product
 * context, send an anonymised category or count — never the user's allergen
 * list, dietary profile, or scan verdict inputs.
 * ============================================================================
 *
 * - Sentry (crash reporting): initialized at startup ONLY if VITE_SENTRY_DSN
 *   is set. Crash reporting is not gated on analytics consent.
 * - PostHog (product analytics): initialized ONLY after the user explicitly
 *   grants consent (consent store === 'granted'). EU cloud by default.
 */
import * as Sentry from '@sentry/react'
import posthog from 'posthog-js'
import { env } from './env'
import { useConsentStore } from '../stores/consent'

/** Init Sentry crash reporting. No-op (returns false) when no DSN is set. */
export function initSentry(): boolean {
  if (!env.VITE_SENTRY_DSN) return false
  Sentry.init({
    dsn: env.VITE_SENTRY_DSN,
    sendDefaultPii: false,
    // Scrub safety net: drop any event that smuggles dietary/allergy keys.
    beforeSend(event) {
      const serialized = JSON.stringify(event.contexts ?? {}) + JSON.stringify(event.extra ?? {})
      if (/allerg|dietary|diet_profile/i.test(serialized)) {
        return null
      }
      return event
    },
  })
  return true
}

let analyticsInitialized = false

/**
 * Initialize PostHog analytics. Hard-gated:
 * 1. consent store must be 'granted' (explicit user opt-in)
 * 2. VITE_POSTHOG_KEY must be set
 * Safe to call repeatedly (idempotent). Returns true when analytics is live.
 */
export function initAnalytics(): boolean {
  if (analyticsInitialized) return true
  if (useConsentStore.getState().analyticsConsent !== 'granted') return false
  if (!env.VITE_POSTHOG_KEY) return false
  posthog.init(env.VITE_POSTHOG_KEY, {
    api_host: env.VITE_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
    person_profiles: 'identified_only',
    autocapture: false, // explicit events only — avoids accidental PII capture
  })
  analyticsInitialized = true
  return true
}

/** Called when the user denies/revokes consent. */
export function disableAnalytics(): void {
  if (!analyticsInitialized) return
  posthog.opt_out_capturing()
}

/**
 * Capture a product analytics event. Silently no-ops without consent/init.
 * NEVER pass dietary/allergy data in `properties` — see privacy rule above.
 */
export function capture(event: string, properties?: Record<string, string | number | boolean>): void {
  if (!analyticsInitialized) return
  posthog.capture(event, properties)
}

/** Test-only: reset module state between vitest cases. */
export function _resetAnalyticsForTests(): void {
  analyticsInitialized = false
}
