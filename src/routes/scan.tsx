import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Flashlight, X, ScanBarcode, ArrowRight } from 'lucide-react'
import { MOCK_PRODUCTS } from '../lib/mock-catalog'

export const Route = createFileRoute('/scan')({
  component: ScanScreen,
})

/**
 * Fullscreen scanner placeholder. The camera pipeline (ML Kit / native
 * barcode scanning) arrives with the native Capacitor build in Phase 1 —
 * until then, manual barcode entry drives the same /product/$barcode flow.
 * Always dark, regardless of color scheme (camera UX convention).
 */
function ScanScreen() {
  const navigate = useNavigate()
  const [barcode, setBarcode] = useState('')

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const clean = barcode.trim()
    if (!clean) return
    void navigate({ to: '/product/$barcode', params: { barcode: clean } })
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between px-4 pt-[calc(12px+env(safe-area-inset-top))]">
        <button
          type="button"
          disabled
          aria-label="Torch (available with the native build)"
          title="Torch arrives with the native build"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-neutral-500"
        >
          <Flashlight aria-hidden="true" size={24} strokeWidth={2} />
        </button>
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
        {/* Viewfinder placeholder frame */}
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
        <p className="max-w-xs text-center text-sm text-neutral-300">
          Camera scanning arrives with the native build. Type a barcode below to try the flow.
        </p>
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
    </div>
  )
}
