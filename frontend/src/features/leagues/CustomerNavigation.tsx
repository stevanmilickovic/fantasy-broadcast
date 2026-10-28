import { LeagueSelect } from './LeagueSelect'
import { useDismissibleMenus } from './useDismissibleMenus'
import type { AuthUser } from '../auth/types'
import { scoringLabel } from './leagueData'
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
  const menuRef = useDismissibleMenus()
  return (
    <nav className="customer-navigation">
      <button
        className="customer-brand brand-name"
        type="button"
        onClick={() => onNavigate('/leagues')}
      >
        Fantasy Broadcast
      </button>
      <div className="customer-navigation-actions" ref={menuRef}>
        {selectedLeague && (
          <div className="league-switcher">
            <LeagueSelect
              label="League"
              showDescription={false}
              value={selectedLeague.id}
              onChange={(id) => onNavigate(`/league?leagueId=${id}`)}
              options={leagues.map((league) => ({
                value: league.id,
                label: league.displayName,
                description: `${league.leagueType === 'DRAFT' ? 'Draft' : 'Classic'} · ${scoringLabel(league.scoringType)}`,
                badge: league.ownerUserId === user.id ? 'Owner' : undefined,
              }))}
              action={{ label: 'Add or find a league', onClick: () => onNavigate('/leagues/new') }}
            />
          </div>
        )}
        <details className="profile-menu">
          <summary aria-label="Account menu">
            <span className="league-avatar">{user.displayName.slice(0, 1)}</span>
            <span className="account-label">Account</span>
          </summary>
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
