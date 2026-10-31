import { ArrowLeft } from 'lucide-react'
import type { Navigate } from '../../app/useBrowserNavigation'
import { LeagueSubscriptionSettings } from '../billing/LeagueSubscriptionSettings'
import { LeagueMembershipSettings } from './LeagueMembershipSettings'
import type { RegisteredLeague } from './types'

export function LeagueManagementPage({
  league,
  navigate,
  onChanged,
}: {
  league: RegisteredLeague
  navigate: Navigate
  onChanged: () => void
}) {
  return (
    <section className="league-management-page">
      <button className="checkout-back" onClick={() => navigate(`/league?leagueId=${league.id}`)}>
        <ArrowLeft size={17} /> Back to league
      </button>
      <header className="league-management-heading">
        <h1>League management</h1>
        <p>{league.displayName}</p>
      </header>
      <LeagueMembershipSettings league={league} onChanged={onChanged} />
      <LeagueSubscriptionSettings league={league} navigate={navigate} onChanged={onChanged} />
    </section>
  )
}
