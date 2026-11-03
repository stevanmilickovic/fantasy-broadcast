import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { createPaddleCheckout, previewLeaguePayment, loadPlanAvailability } from './api'
import { LeagueCheckoutPage } from './LeagueCheckoutPage'
import { openPaddleCheckout } from './paddleCheckout'

vi.mock('./api', () => ({
  previewLeaguePayment: vi.fn(),
  createPaddleCheckout: vi.fn(),
  loadPlanAvailability: vi.fn(),
}))
vi.mock('./paddleCheckout', () => ({ openPaddleCheckout: vi.fn() }))

it('requires consent and submits the explicit selected plan', async () => {
  vi.mocked(loadPlanAvailability).mockResolvedValue({ aiBroadcasterEnabled: true })
  vi.mocked(previewLeaguePayment).mockResolvedValue({
    displayName: 'Test league',
    managerCount: 8,
    registrationEligible: true,
    checkoutReady: true,
    validationMessage: null,
  })
  vi.mocked(createPaddleCheckout).mockResolvedValue({
    clientSideToken: 'test',
    priceId: 'price',
    userId: 1,
    fplLeagueId: 42,
    leagueType: 'DRAFT',
    plan: 'AI_BROADCASTER',
    paymentSignature: 'signature',
  })
  render(<LeagueCheckoutPage search="?fplLeagueId=42&leagueType=DRAFT" onNavigate={vi.fn()} />)
  await screen.findByText('Test league')
  const plan = screen.getByRole('button', { name: 'Choose AI Broadcaster' }) as HTMLButtonElement
  expect(plan.disabled).toBe(true)
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(plan)
  await waitFor(() =>
    expect(createPaddleCheckout).toHaveBeenCalledWith(
      '42',
      'DRAFT',
      'AI_BROADCASTER',
      expect.any(AbortSignal),
    ),
  )
  expect(openPaddleCheckout).toHaveBeenCalledOnce()
})

it('offers Standard only when AI is disabled', async () => {
  vi.mocked(loadPlanAvailability).mockResolvedValue({ aiBroadcasterEnabled: false })
  vi.mocked(previewLeaguePayment).mockResolvedValue({
    displayName: 'Standard league',
    managerCount: 8,
    registrationEligible: true,
    checkoutReady: true,
    validationMessage: null,
  })
  vi.mocked(createPaddleCheckout).mockClear()
  render(<LeagueCheckoutPage search="?fplLeagueId=42" onNavigate={vi.fn()} />)
  await screen.findByText('Standard league')
  await screen.findByText(
    'AI Broadcaster is currently unavailable for purchase. Standard is available.',
  )
  expect(screen.queryByRole('button', { name: 'Choose AI Broadcaster' })).toBeNull()
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Choose Standard' }))
  await waitFor(() =>
    expect(createPaddleCheckout).toHaveBeenCalledWith(
      '42',
      'DRAFT',
      'STANDARD',
      expect.any(AbortSignal),
    ),
  )
})
