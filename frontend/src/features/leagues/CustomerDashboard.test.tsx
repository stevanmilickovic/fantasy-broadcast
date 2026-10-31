import { render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { CustomerDashboard } from './CustomerDashboard'
import { loadRegisteredLeagues } from './api'

vi.mock('./api', () => ({ loadRegisteredLeagues: vi.fn() }))
vi.mock('./CustomerNavigation', () => ({ CustomerNavigation: () => null }))
vi.mock('./LeagueRegistrationPage', () => ({ LeagueRegistrationPage: () => null }))
vi.mock('./LeagueDetailPage', () => ({ LeagueDetailPage: () => null }))
vi.mock('../billing/LeagueCheckoutPage', () => ({ LeagueCheckoutPage: () => <p>Checkout page</p> }))
const user = { id: 1, email: 'user@example.test', displayName: 'User', role: 'USER' as const }

it('redirects followers away from owner-only league management', async () => {
  vi.mocked(loadRegisteredLeagues).mockResolvedValue([
    {
      id: 42,
      fplLeagueId: 100,
      displayName: 'Other owner league',
      leagueType: 'DRAFT',
      scoringType: 'H2H',
      serviceEnabled: true,
      aiNarrationEnabled: false,
      voiceNarrationEnabled: false,
      ownerUserId: 2,
    },
  ])
  const navigate = vi.fn()
  render(
    <CustomerDashboard
      user={user}
      pathname="/league/manage"
      search="?leagueId=42"
      onNavigate={navigate}
      onSignOut={vi.fn()}
    />,
  )
  await waitFor(() => expect(navigate).toHaveBeenCalledWith('/league?leagueId=42', true))
  expect(screen.queryByRole('heading', { name: 'League management' })).toBeNull()
})

it.each(['/account-deletion', '/leagues/checkout'])(
  'preserves a direct link to %s when the league list loads',
  async (pathname) => {
    vi.mocked(loadRegisteredLeagues).mockResolvedValue([])
    const navigate = vi.fn()
    render(
      <CustomerDashboard
        user={user}
        pathname={pathname}
        search=""
        onNavigate={navigate}
        onSignOut={vi.fn()}
      />,
    )
    await waitFor(() => expect(loadRegisteredLeagues).toHaveBeenCalled())
    expect(
      screen.getByText(
        pathname === '/account-deletion' ? 'Request account deletion' : 'Checkout page',
        { selector: pathname === '/account-deletion' ? 'h1' : 'p' },
      ),
    ).toBeTruthy()
    expect(navigate).not.toHaveBeenCalled()
  },
)
