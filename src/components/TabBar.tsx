import { Link } from '@tanstack/react-router'
import { House, History, ScanLine, ListChecks, CircleUserRound, type LucideIcon } from 'lucide-react'

function Tab({
  to,
  label,
  Icon,
}: {
  to: '/' | '/history' | '/lists' | '/profile'
  label: string
  Icon: LucideIcon
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === '/' }}
      className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl py-1 text-ink-muted transition-colors data-[status=active]:text-brand-700"
      activeProps={{ 'aria-current': 'page' }}
    >
      <Icon aria-hidden="true" size={24} strokeWidth={2} />
      <span className="text-[11px] font-semibold leading-none">{label}</span>
    </Link>
  )
}

/**
 * Bottom tab bar (MASTER.md): Home, History, center Scan FAB (64px, accent
 * orange, raised), Lists, Profile. Labels always visible; safe-area padded.
 * Hidden on /sign-in and /scan by the root layout.
 */
export function TabBar() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto grid h-16 w-full max-w-md grid-cols-5 items-center px-2">
        <Tab to="/" label="Home" Icon={House} />
        <Tab to="/history" label="History" Icon={History} />
        <div className="relative flex justify-center">
          <Link
            to="/scan"
            aria-label="Scan a product"
            className="absolute -top-11 flex h-16 w-16 items-center justify-center rounded-full bg-accent-500 text-on-accent shadow-[0_8px_32px_rgba(23,29,20,0.24)] transition-transform active:scale-[0.98]"
          >
            <ScanLine aria-hidden="true" size={28} strokeWidth={2} />
          </Link>
          <span className="mt-7 text-[11px] font-semibold leading-none text-ink-muted">Scan</span>
        </div>
        <Tab to="/lists" label="Lists" Icon={ListChecks} />
        <Tab to="/profile" label="Profile" Icon={CircleUserRound} />
      </div>
    </nav>
  )
}
