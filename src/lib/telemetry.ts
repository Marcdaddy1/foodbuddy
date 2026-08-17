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

/**
 * Anything that could carry a user's dietary profile. Matches allergen tags
 * (`en:peanuts`), the words themselves, and our storage keys.
 */
const SENSITIVE_PATTERN =
  /allerg|dietary|diet_profile|intoleran|foodbuddy-dietary|avoid.list|\ben:(milk|eggs|peanuts|nuts|soybeans|gluten|fish|crustaceans|molluscs|celery|mustard|sesame|sulphur|lupin)/i

/** True when a value contains anything resembling dietary data. */
export function containsSensitiveData(value: unknown): boolean {
  if (value == null) return false
  try {
    return SENSITIVE_PATTERN.test(
      typeof value === 'string' ? value : JSON.stringify(value),
    )
  } catch {
    // Circular or unserialisable — assume the worst and drop it.
    return true
  }
}

/** Init Sentry crash reporting. No-op (returns false) when no DSN is set. */
export function initSentry(): boolean {
  if (!env.VITE_SENTRY_DSN) return false
  Sentry.init({
    dsn: env.VITE_SENTRY_DSN,
    sendDefaultPii: false,

    // Session replay would record the allergy grid verbatim. Never enable
    // these without re-reading CLAUDE.md rule 3.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    /**
     * Breadcrumbs were the real leak: Sentry's DOM breadcrumbs serialise each
     * clicked element's id and aria-label, so tapping a severity dropdown
     * emitted `select#severity-en:peanuts`, and removing an avoid-list item
     * emitted `button[aria-label="Remove palm oil from avoid list"]`.
     * Neither went anywhere near beforeSend's old contexts/extra check.
     */
    beforeBreadcrumb(breadcrumb) {
      // The profile screen is entirely dietary data — no UI crumbs from it.
      if (breadcrumb.category?.startsWith('ui.')) {
        const target = String(breadcrumb.message ?? '')
        if (containsSensitiveData(target)) return null
      }
      if (containsSensitiveData(breadcrumb.message) || containsSensitiveData(breadcrumb.data)) {
        return null
      }
      return breadcrumb
    },

    /**
     * Whole-event safety net. The previous version serialised only `contexts`
     * and `extra`, leaving breadcrumbs, tags, request, and the exception
     * message itself unchecked.
     */
    beforeSend(event) {
      const surfaces = [
        event.contexts,
        event.extra,
        event.tags,
        event.request,
        event.breadcrumbs,
        event.message,
        event.exception,
        event.user,
      ]
      if (surfaces.some(containsSensitiveData)) return null
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
    // Session replay defaults to being controlled by REMOTE project config, so
    // without this an admin toggling "Record user sessions" in the PostHog
    // dashboard would start recording the allergy grid with no code change and
    // no review. Pinned off in code.
    disable_session_recording: true,
    mask_all_text: true,
    mask_all_element_attributes: true,
  })
  posthog.opt_in_capturing()
  analyticsInitialized = true
  return true
}

/** Called when the user denies/revokes consent. */
export function disableAnalytics(): void {
  if (!analyticsInitialized) return
  posthog.opt_out_capturing()
  // Cleared so a later re-grant runs the full init path again. Without this,
  // grant -> deny -> grant left PostHog opted out while the UI said "Allowed".
  analyticsInitialized = false
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
