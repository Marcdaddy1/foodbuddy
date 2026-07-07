import { useCallback, useEffect, useRef, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Camera, ScanBarcode, X, ArrowRight } from 'lucide-react'
import { MOCK_PRODUCTS } from '../lib/mock-catalog'
import { isNativeScannerAvailable, scanOnce } from '../lib/native-scanner'

export const Route = createFileRoute('/scan')({
  component: ScanScreen,
})

/** localStorage key: user has seen the camera pre-permission explainer. */
const PRE_PROMPT_SEEN_KEY = 'foodbuddy-camera-preprompt-seen'

/**
 * Fullscreen scanner. Native builds (Capacitor) launch the ML Kit scanner —
 * one tap, torch + autofocus built in, haptic on detect. A pre-permission
 * explainer runs once before the first camera prompt (PRD §7.1: permission
 * denial is unrecoverable friction, explain first). The web build and any
 * scanner failure fall back to manual barcode entry, which drives the same
 * /product/$barcode flow. Always dark, regardless of color scheme.
 */
function ScanScreen() {
  const navigate = useNavigate()
  const [barcode, setBarcode] = useState('')
  const [scanError, setScanError] = useState<string | null>(null)
  const [showPrePrompt, setShowPrePrompt] = useState(false)
  const [scanning, setScanning] = useState(false)
  const nativeAvailable = isNativeScannerAvailable()
  const autoLaunched = useRef(false)

  const launchScanner = useCallback(async () => {
    setScanError(null)
    setScanning(true)
    const outcome = await scanOnce()
    setScanning(false)
    if (outcome.status === 'scanned') {
      void navigate({
        to: '/product/$barcode',
        params: { barcode: outcome.barcode },
      })
    } else if (outcome.status === 'error') {
      setScanError(
        'Camera scanning failed — check camera permission in system settings, or type the barcode below.',
      )
    }
    // 'cancelled' → stay on this screen quietly.
  }, [navigate])

  function acceptPrePrompt() {
    localStorage.setItem(PRE_PROMPT_SEEN_KEY, '1')
    setShowPrePrompt(false)
    void launchScanner()
  }

  // Native: auto-launch the scanner on entry (or the explainer, first time).
  useEffect(() => {
    if (!nativeAvailable || autoLaunched.current) return
    autoLaunched.current = true
    if (localStorage.getItem(PRE_PROMPT_SEEN_KEY)) {
      void launchScanner()
    } else {
      setShowPrePrompt(true)
    }
  }, [nativeAvailable, launchScanner])

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const clean = barcode.trim()
    if (!clean) return
    void navigate({ to: '/product/$barcode', params: { barcode: clean } })
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between px-4 pt-[calc(12px+env(safe-area-inset-top))]">
        <span className="min-h-11 min-w-11" aria-hidden="true" />
        <h1 className="font-heading text-base font-bold">Scan a barcode</h1>
        <Link
          to="/"
          aria-label="Close scanner"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-neutral-100 transition-colors hover:bg-white/10 active:scale-[0.98]"
        >
          <X aria-hidden="true" size={24} strokeWidth={2} />
        </Link>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8">
        {/* Viewfinder frame */}
        <div
          aria-hidden="true"
          className="relative h-44 w-full max-w-xs rounded-2xl border-2 border-dashed border-neutral-600"
        >
          <span className="absolute -left-0.5 -top-0.5 h-8 w-8 rounded-tl-2xl border-l-4 border-t-4 border-brand-400" />
          <span className="absolute -right-0.5 -top-0.5 h-8 w-8 rounded-tr-2xl border-r-4 border-t-4 border-brand-400" />
          <span className="absolute -bottom-0.5 -left-0.5 h-8 w-8 rounded-bl-2xl border-b-4 border-l-4 border-brand-400" />
          <span className="absolute -bottom-0.5 -right-0.5 h-8 w-8 rounded-br-2xl border-b-4 border-r-4 border-brand-400" />
          <div className="flex h-full items-center justify-center">
            <ScanBarcode size={40} strokeWidth={2} className="text-neutral-600" />
          </div>
        </div>

        {nativeAvailable ? (
          <>
            <button
              type="button"
              onClick={() => void launchScanner()}
              disabled={scanning}
              className="flex min-h-12 items-center gap-2 rounded-xl bg-accent-500 px-5 text-base font-semibold text-on-accent transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              <Camera aria-hidden="true" size={20} strokeWidth={2} />
              {scanning ? 'Opening camera…' : 'Open camera scanner'}
            </button>
            {scanError && (
              <p role="alert" className="max-w-xs text-center text-sm text-danger-500">
                {scanError}
              </p>
            )}
          </>
        ) : (
          <p className="max-w-xs text-center text-sm text-neutral-300">
            Camera scanning works in the FoodBuddy mobile app. Type a barcode below to
            use the same flow here.
          </p>
        )}
      </div>

      <div className="px-4 pb-[calc(24px+env(safe-area-inset-bottom))]">
        <form onSubmit={submit} className="flex gap-2">
          <label className="sr-only" htmlFor="manual-barcode">
            Barcode
          </label>
          <input
            id="manual-barcode"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Enter a barcode, e.g. 3017620422003"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value.replace(/[^0-9]/g, ''))}
            className="min-h-12 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 text-base text-neutral-100 placeholder:text-neutral-500 focus:border-brand-400 focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Look up barcode"
            className="flex min-h-12 min-w-12 items-center justify-center rounded-xl bg-accent-500 text-on-accent transition-transform active:scale-[0.98]"
          >
            <ArrowRight aria-hidden="true" size={24} strokeWidth={2} />
          </button>
        </form>

        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Quick try
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {MOCK_PRODUCTS.map((product) => (
            <Link
              key={product.barcode}
              to="/product/$barcode"
              params={{ barcode: product.barcode }}
              className="min-h-11 rounded-full border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm font-medium text-neutral-100 transition-colors hover:border-brand-400 active:scale-[0.98]"
            >
              {product.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Camera pre-permission explainer (native, first scan only) */}
      {showPrePrompt && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="preprompt-title"
          className="absolute inset-0 z-50 flex items-end bg-black/70"
        >
          <div className="w-full rounded-t-2xl bg-neutral-900 p-6 pb-[calc(24px+env(safe-area-inset-bottom))]">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-700 text-on-brand">
              <Camera aria-hidden="true" size={24} strokeWidth={2} />
            </span>
            <h2 id="preprompt-title" className="mt-3 font-heading text-lg font-bold">
              FoodBuddy needs your camera
            </h2>
            <p className="mt-1 text-sm text-neutral-300">
              Only to read barcodes, right on your device. No photos are stored or
              uploaded.
            </p>
            <button
              type="button"
              onClick={acceptPrePrompt}
              className="mt-4 min-h-12 w-full rounded-xl bg-accent-500 text-base font-semibold text-on-accent transition-transform active:scale-[0.98]"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={() => setShowPrePrompt(false)}
              className="mt-2 min-h-11 w-full rounded-xl text-sm font-semibold text-neutral-300"
            >
              Not now — I&apos;ll type barcodes
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
