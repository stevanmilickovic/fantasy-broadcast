import { ArrowRight, Plus } from 'lucide-react'
import { useState } from 'react'
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
  const [search, setSearch] = useState('')
  const filtered = leagues.filter((league) =>
    league.displayName.toLowerCase().includes(search.toLowerCase()),
  )
  return (
    <section className="league-picker">
      <header>
        <div>
          <span className="kicker">Welcome back, {user.displayName}</span>
          <h1>Your leagues</h1>
          <p>Explore your standings, teams and matchups.</p>
        </div>
        <button className="add-league-card" onClick={() => onNavigate('/leagues/new')}>
          <Plus size={18} /> Add or find a league
        </button>
      </header>
      {leagues.length > 6 && (
        <label className="league-filter">
          Search leagues
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
      )}
      <div className="league-cards">
        {filtered.map((league) => (
          <a className="league-card" key={league.id} href={`/league?leagueId=${league.id}`}>
            <span>
              {league.leagueType === 'DRAFT' ? 'Draft' : 'Classic'} ·{' '}
              {scoringLabel(league.scoringType)}
              {league.ownerUserId === user.id && <OwnerBadge />}
            </span>
            <strong>{league.displayName}</strong>
            <small>FPL league #{league.fplLeagueId}</small>
            <span className="league-card-open">
              Open league <ArrowRight size={19} />
            </span>
          </a>
        ))}
      </div>
      {!filtered.length && <p className="league-empty">No leagues match your search.</p>}
    </section>
  )
}
