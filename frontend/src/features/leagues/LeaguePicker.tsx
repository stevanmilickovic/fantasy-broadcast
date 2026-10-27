import type { AuthUser } from '../auth/types'
import { scoringLabel } from './leagueData'
import { OwnerBadge } from './OwnerBadge'
import type { RegisteredLeague } from './types'
export function LeaguePicker({
  leagues,
  user,
  onNavigate,
}: {
  leagues: RegisteredLeague[]
  user: AuthUser
  onNavigate: (path: string) => void
}) {
  return (
    <section className="league-picker">
      <header>
        <span className="kicker">Welcome back, {user.displayName}</span>
        <h1>Choose a league</h1>
        <p>Select the league you want to open.</p>
      </header>
      <div className="league-cards">
        {leagues.map((league) => (
          <button
            type="button"
            className="league-card"
            key={league.id}
            onClick={() => onNavigate(`/league?leagueId=${league.id}`)}
          >
            <span>
              {league.leagueType === 'DRAFT' ? 'Draft' : 'Classic'} ·{' '}
              {scoringLabel(league.scoringType)}
              {league.ownerUserId === user.id && <OwnerBadge />}
            </span>
            <strong>{league.displayName}</strong>
            <small>FPL league #{league.fplLeagueId}</small>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="secondary-action add-league-card"
        onClick={() => onNavigate('/leagues/new')}
      >
        Add or find a league
      </button>
    </section>
  )
}
