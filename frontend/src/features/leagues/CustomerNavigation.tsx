import type { AuthUser } from '../auth/types'
import { scoringLabel } from './leagueData'
import { OwnerBadge } from './OwnerBadge'
import type { RegisteredLeague } from './types'
export function CustomerNavigation({
  leagues,
  selectedLeague,
  user,
  onNavigate,
  onSignOut,
}: {
  leagues: RegisteredLeague[]
  selectedLeague: RegisteredLeague | null
  user: AuthUser
  onNavigate: (path: string) => void
  onSignOut: () => void
}) {
  return (
    <nav className="customer-navigation">
      <button
        className="customer-brand brand-name"
        type="button"
        onClick={() => onNavigate('/leagues')}
      >
        Fantasy Broadcast
      </button>
      <div className="customer-navigation-actions">
        {selectedLeague && (
          <details className="league-switcher">
            <summary>
              {selectedLeague.displayName}
              {selectedLeague.ownerUserId === user.id && <OwnerBadge />}
            </summary>
            <div>
              {leagues.map((league) => (
                <button
                  type="button"
                  key={league.id}
                  onClick={() => onNavigate(`/league?leagueId=${league.id}`)}
                >
                  {league.displayName} · {scoringLabel(league.scoringType)}
                  {league.ownerUserId === user.id && <OwnerBadge />}
                </button>
              ))}
              <button
                type="button"
                className="switcher-add"
                onClick={() => onNavigate('/leagues/new')}
              >
                Add or find a league
              </button>
            </div>
          </details>
        )}
        <details className="profile-menu">
          <summary>Profile</summary>
          <div>
            <strong>{user.displayName}</strong>
            <button type="button" onClick={onSignOut}>
              Sign out
            </button>
          </div>
        </details>
      </div>
    </nav>
  )
}
