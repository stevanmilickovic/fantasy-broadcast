import { ArrowLeft, ChevronDown } from 'lucide-react'
import { TeamEmblemProvider } from './TeamEmblemProvider'
import { LeagueEmblemSettings } from './LeagueEmblemSettings'
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
      <a
        className="checkout-back"
        href={`/league?leagueId=${league.id}`}
        onClick={(event) => {
          if (
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return
          event.preventDefault()
          navigate(`/league?leagueId=${league.id}`)
        }}
      >
        <ArrowLeft size={17} /> Back to league
      </a>
      <header className="league-management-heading">
        <h1>League management</h1>
        <p>{league.displayName}</p>
      </header>
      <LeagueMembershipSettings league={league} onChanged={onChanged} />
      <details className="league-management-disclosure">
        <summary>
          Team emblems <ChevronDown size={16} aria-hidden="true" />
        </summary>
        <TeamEmblemProvider leagueId={league.id}>
          <LeagueEmblemSettings leagueId={league.id} />
        </TeamEmblemProvider>
      </details>
      <LeagueSubscriptionSettings
        league={league}
        navigate={navigate}
        onChanged={onChanged}
        collapsible
      />
    </section>
  )
}
