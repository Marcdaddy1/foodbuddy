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
import { HomeScreen } from './HomeScreen'
import { useConsentStore } from '../stores/consent'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
      signOut: mocks.signOut,
    },
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
  const signInRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/sign-in',
    component: () => null,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, signInRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return render(<RouterProvider router={router} />)
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
  })

  it('shows the signed-out welcome state with a sign-in link', async () => {
    renderHome()
    expect(await screen.findByText(/welcome to foodbuddy/i)).toBeInTheDocument()
    const signInLink = screen.getByRole('link', { name: /sign in/i })
    expect(signInLink).toHaveAttribute('href', '/sign-in')
  })

  it('shows the hello state with the user email when signed in', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { email: 'buddy@example.com' } } },
    })
    renderHome()
    expect(
      await screen.findByText(/hello, buddy@example\.com/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/foodbuddy skeleton is alive/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /sign out/i }),
    ).toBeInTheDocument()
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
