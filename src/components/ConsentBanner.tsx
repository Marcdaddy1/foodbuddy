import { useConsentStore } from '../stores/consent'
import { initAnalytics, disableAnalytics } from '../lib/telemetry'

/**
 * Dismissible analytics-consent banner. Shown only while consent is 'unset'.
 * Granting consent is the ONLY path that initializes PostHog.
 * Positioned above the fixed tab bar (96px + safe area).
 */
export function ConsentBanner() {
  const consent = useConsentStore((s) => s.analyticsConsent)
  const grant = useConsentStore((s) => s.grant)
  const deny = useConsentStore((s) => s.deny)

  if (consent !== 'unset') return null

  return (
    <div
      role="region"
      aria-label="Analytics consent"
      className="fixed inset-x-4 bottom-[calc(96px+env(safe-area-inset-bottom))] z-50 mx-auto max-w-md rounded-2xl bg-surface p-4 shadow-[0_8px_32px_rgba(23,29,20,0.16)] ring-1 ring-ink/10"
    >
      <p className="text-sm text-ink">
        Can we collect anonymous usage analytics to improve FoodBuddy? Your
        dietary and allergy data is never included.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="min-h-11 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-on-brand transition-colors active:scale-[0.98]"
          onClick={() => {
            grant()
            initAnalytics()
          }}
        >
          Allow analytics
        </button>
        <button
          type="button"
          className="min-h-11 rounded-xl bg-surface-muted px-4 text-sm font-semibold text-ink-muted transition-colors hover:text-ink active:scale-[0.98]"
          onClick={() => {
            deny()
            disableAnalytics()
          }}
        >
          No thanks
        </button>
      </div>
    </div>
  )
}
