import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { createPaddleCheckout, previewLeaguePayment, loadPlanAvailability } from './api'
import { LeagueCheckoutPage } from './LeagueCheckoutPage'
import { openPaddleCheckout } from './paddleCheckout'

vi.mock('./api', () => ({
  previewLeaguePayment: vi.fn(),
  createPaddleCheckout: vi.fn(),
  loadPlanAvailability: vi.fn(),
}))
vi.mock('./paddleCheckout', () => ({ openPaddleCheckout: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(openPaddleCheckout).mockResolvedValue({ status: 'closed' })
})

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
  render(
    <LeagueCheckoutPage
      leagueId="42"
      leagueType="DRAFT"
      selectedPlan="AI_BROADCASTER"
      onNavigate={vi.fn()}
    />,
  )
  await screen.findByText('Test league')
  const payment = screen.getByRole('button', { name: 'Continue to payment' }) as HTMLButtonElement
  await waitFor(() => expect(payment.disabled).toBe(false))
  fireEvent.click(payment)
  const consent = screen.getByRole('checkbox')
  await waitFor(() => expect(document.activeElement).toBe(consent))
  expect(consent.getAttribute('aria-invalid')).toBe('true')
  expect(createPaddleCheckout).not.toHaveBeenCalled()
  expect(openPaddleCheckout).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('checkbox'))
  expect(consent.getAttribute('aria-invalid')).toBe('false')
  expect(createPaddleCheckout).not.toHaveBeenCalled()
  fireEvent.click(payment)
  await waitFor(() =>
    expect(createPaddleCheckout).toHaveBeenCalledWith(
      '42',
      'DRAFT',
      'AI_BROADCASTER',
      { acceptedPolicies: true, termsVersion: '2026-10-29' },
      expect.any(AbortSignal),
    ),
  )
  expect(openPaddleCheckout).toHaveBeenCalledOnce()
})

it.each([false, true])(
  'does not create checkout when league eligibility is %s and billing is unavailable',
  async (registrationEligible) => {
    vi.mocked(loadPlanAvailability).mockResolvedValue({ aiBroadcasterEnabled: true })
    vi.mocked(previewLeaguePayment).mockResolvedValue({
      displayName: 'Unavailable league',
      managerCount: 8,
      registrationEligible,
      checkoutReady: false,
      validationMessage: registrationEligible ? null : 'Check league details.',
    })
    render(
      <LeagueCheckoutPage
        leagueId="42"
        leagueType="DRAFT"
        selectedPlan="STANDARD"
        onNavigate={vi.fn()}
      />,
    )
    await screen.findByText('Unavailable league')
    expect(screen.queryByRole('checkbox')).toBeNull()
    const payment = screen.queryByRole('button', {
      name: 'Continue to payment',
    }) as HTMLButtonElement | null
    if (registrationEligible) expect(payment?.disabled).toBe(true)
    else expect(payment).toBeNull()
    expect(createPaddleCheckout).not.toHaveBeenCalled()
    expect(openPaddleCheckout).not.toHaveBeenCalled()
  },
)

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
  render(
    <LeagueCheckoutPage
      leagueId="42"
      leagueType="DRAFT"
      selectedPlan="STANDARD"
      onNavigate={vi.fn()}
    />,
  )
  await screen.findByText('Standard league')
  fireEvent.click(screen.getByRole('button', { name: 'Change plan' }))
  expect((screen.getByRole('radio', { name: /AI Broadcaster/ }) as HTMLInputElement).disabled).toBe(
    true,
  )
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Continue to payment' }))
  await waitFor(() =>
    expect(createPaddleCheckout).toHaveBeenCalledWith(
      '42',
      'DRAFT',
      'STANDARD',
      { acceptedPolicies: true, termsVersion: '2026-10-29' },
      expect.any(AbortSignal),
    ),
  )
})
