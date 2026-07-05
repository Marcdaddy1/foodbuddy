import { createRootRoute, Outlet } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as Sentry from '@sentry/react'

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
    <div className="mx-auto mt-16 w-full max-w-md rounded-xl bg-surface p-6 text-center shadow-sm">
      <h1 className="text-lg font-bold text-danger-500">Something went wrong</h1>
      <p className="mt-1 text-sm text-ink-muted">
        The error has been reported. Reload to keep going.
      </p>
      <button
        type="button"
        className="mt-4 rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-400"
        onClick={() => window.location.reload()}
      >
        Reload
      </button>
    </div>
  )
}

function RootLayout() {
  return (
    <Sentry.ErrorBoundary fallback={<CrashFallback />}>
      <QueryClientProvider client={queryClient}>
        <div className="flex min-h-svh flex-col bg-surface-muted">
          <header className="bg-brand-700 px-4 py-3 shadow-md">
            <div className="mx-auto flex w-full max-w-md items-center gap-2">
              <span aria-hidden="true" className="text-xl">
                🥗
              </span>
              <span className="text-lg font-bold tracking-tight text-white">
                FoodBuddy
              </span>
            </div>
          </header>
          <main className="flex-1">
            <Outlet />
          </main>
        </div>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
})
