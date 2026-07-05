import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { initSentry, initAnalytics } from './lib/telemetry'
import './index.css'

// Crash reporting: no-op unless VITE_SENTRY_DSN is set.
initSentry()
// Analytics: no-op unless the user previously granted consent (persisted).
initAnalytics()

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
