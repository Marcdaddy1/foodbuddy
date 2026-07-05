import { useConsentStore } from '../stores/consent'
import { initAnalytics, disableAnalytics } from '../lib/telemetry'

/**
 * Dismissible analytics-consent banner. Shown only while consent is 'unset'.
 * Granting consent is the ONLY path that initializes PostHog.
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
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-xl bg-surface p-4 shadow-lg ring-1 ring-ink/10"
    >
      <p className="text-sm text-ink">
        Can we collect anonymous usage analytics to improve FoodBuddy? Your
        dietary and allergy data is never included.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-400"
          onClick={() => {
            grant()
            initAnalytics()
          }}
        >
          Allow analytics
        </button>
        <button
          type="button"
          className="rounded-lg bg-surface-muted px-4 py-2 text-sm font-semibold text-ink-muted hover:text-ink"
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
