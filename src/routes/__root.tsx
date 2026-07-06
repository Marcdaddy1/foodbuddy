import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as Sentry from '@sentry/react'
import { TabBar } from '../components/TabBar'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

function CrashFallback() {
  return (
    <div className="mx-auto mt-16 w-full max-w-md rounded-2xl bg-surface p-6 text-center shadow-[0_8px_32px_rgba(23,29,20,0.08)]">
      <h1 className="text-lg font-bold text-danger-500">Something went wrong</h1>
      <p className="mt-1 text-sm text-ink-muted">
        The error has been reported. Reload to keep going.
      </p>
      <button
        type="button"
        className="mt-4 min-h-11 rounded-xl bg-brand-700 px-5 text-sm font-semibold text-on-brand transition-colors active:scale-[0.98]"
        onClick={() => window.location.reload()}
      >
        Reload
      </button>
    </div>
  )
}

/** Routes that own the full viewport — no tab bar (MASTER.md). */
const FULLSCREEN_ROUTES = ['/sign-in', '/scan']

function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const showTabBar = !FULLSCREEN_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  )

  return (
    <Sentry.ErrorBoundary fallback={<CrashFallback />}>
      <QueryClientProvider client={queryClient}>
        <div className="flex min-h-svh flex-col bg-surface-muted">
          <main className="flex-1">
            <Outlet />
          </main>
          {showTabBar && <TabBar />}
        </div>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
})
