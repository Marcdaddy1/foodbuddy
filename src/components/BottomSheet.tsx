import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

/**
 * Minimal modal bottom sheet: overlay + rounded-t panel, Escape/overlay/X to
 * close. Motion is transition-only (150–250ms) and disabled entirely under
 * prefers-reduced-motion via the global CSS rule.
 */
export function BottomSheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close sheet"
        className="absolute inset-0 cursor-default bg-black/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 w-full max-w-md rounded-t-2xl bg-surface p-4 pb-[calc(16px+env(safe-area-inset-bottom))] shadow-[0_-8px_32px_rgba(23,29,20,0.16)]"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink/15" aria-hidden="true" />
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-ink-muted transition-colors hover:text-ink active:scale-[0.98]"
            onClick={onClose}
          >
            <X size={24} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-1">{children}</div>
      </div>
    </div>
  )
}
