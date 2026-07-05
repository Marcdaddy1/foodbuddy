import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn(),
    capture: vi.fn(),
    opt_out_capturing: vi.fn(),
  },
}))

vi.mock('@sentry/react', () => ({
  init: vi.fn(),
}))

// Modules are dynamically imported after vi.resetModules() so that env.ts
// re-reads the stubbed import.meta.env and telemetry state starts fresh.
async function loadModules() {
  const posthog = (await import('posthog-js')).default
  const sentry = await import('@sentry/react')
  const { useConsentStore } = await import('../stores/consent')
  const telemetry = await import('./telemetry')
  return { posthog, sentry, useConsentStore, telemetry }
}

describe('telemetry consent gate', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('does NOT init PostHog while consent is unset, even with a key present', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test')
    const { posthog, telemetry } = await loadModules()
    expect(telemetry.initAnalytics()).toBe(false)
    expect(posthog.init).not.toHaveBeenCalled()
  })

  it('does NOT init PostHog when consent is denied', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test')
    const { posthog, useConsentStore, telemetry } = await loadModules()
    useConsentStore.getState().deny()
    expect(telemetry.initAnalytics()).toBe(false)
    expect(posthog.init).not.toHaveBeenCalled()
  })

  it('inits PostHog only after consent is granted', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test')
    const { posthog, useConsentStore, telemetry } = await loadModules()
    useConsentStore.getState().grant()
    expect(telemetry.initAnalytics()).toBe(true)
    expect(posthog.init).toHaveBeenCalledTimes(1)
    // Idempotent on repeat calls
    expect(telemetry.initAnalytics()).toBe(true)
    expect(posthog.init).toHaveBeenCalledTimes(1)
  })

  it('does not init when consent is granted but no PostHog key is configured', async () => {
    const { posthog, useConsentStore, telemetry } = await loadModules()
    useConsentStore.getState().grant()
    expect(telemetry.initAnalytics()).toBe(false)
    expect(posthog.init).not.toHaveBeenCalled()
  })

  it('capture() is a no-op before analytics is initialized', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test')
    const { posthog, telemetry } = await loadModules()
    telemetry.capture('scan_completed')
    expect(posthog.capture).not.toHaveBeenCalled()
  })

  it('capture() forwards events after consent + init', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test')
    const { posthog, useConsentStore, telemetry } = await loadModules()
    useConsentStore.getState().grant()
    telemetry.initAnalytics()
    telemetry.capture('scan_completed', { source: 'barcode' })
    expect(posthog.capture).toHaveBeenCalledWith('scan_completed', {
      source: 'barcode',
    })
  })

  it('initSentry() is a no-op without a DSN', async () => {
    const { sentry, telemetry } = await loadModules()
    expect(telemetry.initSentry()).toBe(false)
    expect(sentry.init).not.toHaveBeenCalled()
  })

  it('initSentry() initializes when a DSN is set', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://key@o0.ingest.sentry.io/0')
    const { sentry, telemetry } = await loadModules()
    expect(telemetry.initSentry()).toBe(true)
    expect(sentry.init).toHaveBeenCalledTimes(1)
  })
})
