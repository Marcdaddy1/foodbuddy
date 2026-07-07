import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HomeScreen } from './HomeScreen'
import { useConsentStore } from '../stores/consent'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
  limit: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
      signOut: mocks.signOut,
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({ limit: mocks.limit }),
        }),
      }),
    }),
  },
  isSupabaseConfigured: true,
}))

function renderHome() {
  const rootRoute = createRootRoute()
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: HomeScreen,
  })
  const stubRoutes = ['/sign-in', '/scan', '/history', '/lists', '/profile', '/product/$barcode'].map(
    (path) =>
      createRoute({
        getParentRoute: () => rootRoute,
        path,
        component: () => null,
      }),
  )
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, ...stubRoutes]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('HomeScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    useConsentStore.setState({ analyticsConsent: 'unset' })
    mocks.getSession.mockResolvedValue({ data: { session: null } })
    mocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
    mocks.limit.mockResolvedValue({ data: [], error: null })
  })

  it('shows the signed-out welcome state with a sign-in link', async () => {
    renderHome()
    expect(await screen.findByText(/welcome to foodbuddy/i)).toBeInTheDocument()
    const signInLink = screen.getByRole('link', { name: /sign in/i })
    expect(signInLink).toHaveAttribute('href', '/sign-in')
  })

  it('shows the signed-in state with the user email and a sign-out button', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { email: 'buddy@example.com' } } },
    })
    renderHome()
    expect(
      (await screen.findAllByText(/buddy@example\.com/i)).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getByRole('button', { name: /sign out/i }),
    ).toBeInTheDocument()
  })

  it('shows the scan CTA and labelled sample scans while signed out', async () => {
    renderHome()
    const scanLink = await screen.findByRole('link', { name: /scan a product/i })
    expect(scanLink).toHaveAttribute('href', '/scan')
    expect(screen.getByRole('region', { name: /recent scans/i })).toBeInTheDocument()
    expect(screen.getByText('Nutella')).toBeInTheDocument()
    expect(screen.getByText(/sample data/i)).toBeInTheDocument()
  })

  it('shows real scan history rows when signed in', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1', email: 'buddy@example.com' } } },
    })
    mocks.limit.mockResolvedValue({
      data: [
        {
          id: 'scan-1',
          barcode: '5000159407236',
          scanned_at: new Date().toISOString(),
          verdict: 'caution',
          score: 31,
          products: { name: 'Snickers', brand: 'Mars' },
        },
      ],
      error: null,
    })
    renderHome()

    expect(await screen.findByText('Snickers')).toBeInTheDocument()
    // Score and grade band are split across nested elements
    expect(screen.getByText('31')).toBeInTheDocument()
    expect(screen.getByText(/·\s*D/)).toBeInTheDocument()
    expect(screen.queryByText(/sample data/i)).not.toBeInTheDocument()
    // Mock catalog entries must NOT leak into the signed-in view
    expect(screen.queryByText('Nutella')).not.toBeInTheDocument()
  })

  it('shows an empty-state hint when signed in with no scans yet', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1', email: 'buddy@example.com' } } },
    })
    renderHome()

    expect(await screen.findByText(/no scans yet/i)).toBeInTheDocument()
    expect(screen.queryByText('Nutella')).not.toBeInTheDocument()
  })

  it('shows the consent banner while consent is unset and hides it after "No thanks"', async () => {
    const user = userEvent.setup()
    renderHome()
    expect(
      await screen.findByRole('region', { name: /analytics consent/i }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /no thanks/i }))

    expect(
      screen.queryByRole('region', { name: /analytics consent/i }),
    ).not.toBeInTheDocument()
    expect(useConsentStore.getState().analyticsConsent).toBe('denied')
  })
})
