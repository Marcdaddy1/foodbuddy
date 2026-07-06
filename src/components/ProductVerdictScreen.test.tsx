import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { ProductVerdictScreen } from './ProductVerdictScreen'
import { useDietaryProfileStore } from '../stores/dietary-profile'

function renderVerdict(barcode: string) {
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
  return render(<RouterProvider router={router} />)
}

describe('ProductVerdictScreen', () => {
  beforeEach(() => {
    useDietaryProfileStore.setState({
      allergies: [],
      intolerances: [],
      dietPatterns: [],
      customAvoid: [],
    })
  })

  it('renders the full verdict screen for a known product', async () => {
    renderVerdict('3017620422003')

    expect(await screen.findByRole('heading', { name: 'Nutella' })).toBeInTheDocument()
    // Verdict banner (Safe — empty profile) with icon+label+rule
    expect(screen.getByRole('status')).toHaveTextContent(/safe for you/i)
    expect(screen.getByText(/no conflicts with your dietary profile/i)).toBeInTheDocument()
    // Score ring with grade band
    expect(
      screen.getByRole('img', { name: /health score 22 out of 100, grade d/i }),
    ).toBeInTheDocument()
    // Category breakdown
    expect(screen.getByRole('progressbar', { name: /nutrition score/i })).toBeInTheDocument()
    // Attribution + disclaimer
    expect(screen.getByText(/open food facts/i)).toBeInTheDocument()
    expect(
      screen.getByText(/informational only, not medical advice/i),
    ).toBeInTheDocument()
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

  it('opens the ingredient detail sheet on tap', async () => {
    const user = userEvent.setup()
    renderVerdict('3017620422003')

    await user.click(await screen.findByRole('button', { name: /skimmed milk powder/i }))

    const sheet = screen.getByRole('dialog')
    expect(sheet).toHaveTextContent(/dried cow’s milk/i)
    expect(sheet).toHaveTextContent(/evidence/i)
  })

  it('shows a friendly not-found state for an unknown barcode', async () => {
    renderVerdict('0000000000000')
    expect(
      await screen.findByText(/we don't know this product yet/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /help us add it/i })).toBeDisabled()
  })
})
