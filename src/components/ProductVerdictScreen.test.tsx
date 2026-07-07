import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { ProductVerdictScreen } from './ProductVerdictScreen'
import { useDietaryProfileStore } from '../stores/dietary-profile'
import { OFF_NOT_FOUND, OFF_NUTELLA } from '../lib/off/__fixtures__/off-fixtures'
import type { ProductRow } from '../lib/off'

const mocks = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
  invoke: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  insert: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) =>
      table === 'scan_history'
        ? { insert: mocks.insert }
        : {
            select: () => ({
              eq: () => ({ maybeSingle: mocks.maybeSingle }),
            }),
          },
    functions: { invoke: mocks.invoke },
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
    },
  },
  isSupabaseConfigured: true,
}))

const fetchMock = vi.fn()

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function staleRow(): ProductRow {
  return {
    id: 'a2c1e1de-0000-4000-8000-000000000001',
    barcode: '3017620422003',
    name: 'Nutella (cached)',
    brand: 'Ferrero',
    categories: ['spreads'],
    ingredients_raw: 'Sugar, palm oil, hazelnuts 13%, skimmed milk powder 8.7%.',
    nutriments: { 'sugars_100g': 56.3, 'energy-kcal_100g': 539 },
    nova_group: 4,
    allergen_tags: ['en:milk', 'en:nuts', 'en:soybeans'],
    off_last_fetched_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    data_source: 'openfoodfacts',
    created_at: '2026-05-01T00:00:00.000Z',
    updated_at: '2026-05-01T00:00:00.000Z',
  }
}

function renderVerdict(barcode: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const rootRoute = createRootRoute()
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <ProductVerdictScreen barcode={barcode} />,
  })
  const scanRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/scan',
    component: () => null,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, scanRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('ProductVerdictScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
    useDietaryProfileStore.setState({
      allergies: [],
      intolerances: [],
      dietPatterns: [],
      customAvoid: [],
    })
    // Default: no cache row, signed out, cache write succeeds.
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null })
    mocks.invoke.mockResolvedValue({ data: { ok: true }, error: null })
    mocks.getSession.mockResolvedValue({ data: { session: null } })
    mocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
    mocks.insert.mockResolvedValue({ error: null })
    fetchMock.mockResolvedValue(jsonResponse(OFF_NUTELLA))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the full verdict screen from live OFF data', async () => {
    renderVerdict('3017620422003')

    expect(await screen.findByRole('heading', { name: 'Nutella' })).toBeInTheDocument()
    // Verdict banner (Safe — empty profile) with icon+label+rule
    expect(screen.getByRole('status')).toHaveTextContent(/safe for you/i)
    expect(screen.getByText(/no conflicts with your dietary profile/i)).toBeInTheDocument()
    // Score ring computed by the deterministic engine (value not hard-coded here)
    expect(
      screen.getByRole('img', { name: /health score \d+ out of 100, grade [a-e]/i }),
    ).toBeInTheDocument()
    // Category breakdown from the scoring engine
    expect(screen.getByRole('progressbar', { name: /nutrition score/i })).toBeInTheDocument()
    // NOVA line from real data
    expect(screen.getByText('NOVA 4 — ultra-processed food')).toBeInTheDocument()
    // Real nutrition table row
    expect(screen.getByText('Sugars')).toBeInTheDocument()
    // Attribution + disclaimer
    expect(screen.getByText(/open food facts/i)).toBeInTheDocument()
    expect(screen.getByText(/informational only, not medical advice/i)).toBeInTheDocument()
  })

  it('shows a loading skeleton (with reserved layout) while the lookup is pending', async () => {
    let resolveFetch: (value: Response) => void = () => {}
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve
        }),
    )
    renderVerdict('3017620422003')

    expect(await screen.findByText(/looking up product/i)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Nutella' })).not.toBeInTheDocument()

    resolveFetch(jsonResponse(OFF_NUTELLA))
    expect(await screen.findByRole('heading', { name: 'Nutella' })).toBeInTheDocument()
  })

  it('flips the banner to Avoid with the triggering rule when a milk allergy is set', async () => {
    useDietaryProfileStore.setState({
      allergies: [{ tag: 'en:milk', severity: 'severe' }],
      intolerances: [],
      dietPatterns: [],
      customAvoid: [],
    })
    renderVerdict('3017620422003')

    const banner = await screen.findByRole('status')
    expect(banner).toHaveTextContent(/avoid/i)
    expect(banner).toHaveTextContent('Contains milk — your allergy')
  })

  it('opens the ingredient sheet with the "Explanation coming soon" fallback', async () => {
    const user = userEvent.setup()
    renderVerdict('3017620422003')

    await user.click(await screen.findByRole('button', { name: /skimmed milk powder/i }))

    const sheet = screen.getByRole('dialog')
    expect(sheet).toHaveTextContent(/explanation coming soon/i)
    expect(sheet).toHaveTextContent(/never\s+affect scores or verdicts/i)
    expect(sheet).toHaveTextContent(/milk/i)
  })

  it('shows a friendly not-found state for an unknown barcode', async () => {
    fetchMock.mockResolvedValue(jsonResponse(OFF_NOT_FOUND, 404))
    renderVerdict('0000000000000')

    expect(await screen.findByText(/we don't know this product yet/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /help us add it/i })).toBeDisabled()
  })

  it('shows the error state with a retry button when OFF is unreachable', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    renderVerdict('3017620422003')

    expect(
      await screen.findByText(/couldn't look up this product/i, undefined, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  }, 10_000)

  it('serves stale cached data with a "showing cached data" banner when OFF is down', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: staleRow(), error: null })
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    renderVerdict('3017620422003')

    expect(
      await screen.findByRole('heading', { name: 'Nutella (cached)' }, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(screen.getByText(/showing cached data/i)).toBeInTheDocument()
  }, 10_000)
})
