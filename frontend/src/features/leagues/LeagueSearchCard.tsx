import type { ReactNode } from 'react'
import type { AuthUser } from '../auth/types'
import { scoringLabel } from './leagueData'
import { OwnerBadge } from './OwnerBadge'
import type { RegisteredLeague } from './types'
export function LeagueSearchCard({
  busy,
  message,
  searchResults,
  pagination,
  loading,
  onRetry,
  user,
  query,
  onQueryChange,
  onSearch,
  onFollow,
}: {
  busy: boolean
  message: string | null
  searchResults: RegisteredLeague[]
  pagination: ReactNode
  loading: boolean
  onRetry: () => void
  user: AuthUser
  query: string
  onQueryChange: (value: string) => void
  onSearch: (query: string) => void
  onFollow: (league: RegisteredLeague) => void
}) {
  const noResults = !loading && searchResults.length === 0 && !message
  return (
    <div className="register-league-card find-league-card">
      <span className="kicker">Follow</span>
      <h1>Find leagues</h1>
      <div className="league-search">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            onSearch(query)
          }}
        >
          <input
            id="registered-league-search"
            type="search"
            aria-label="League name or ID"
            value={query}
            onChange={(event) => {
              onQueryChange(event.target.value)
            }}
            placeholder="League name or ID"
          />
          <button type="submit" className="secondary-action" disabled={busy}>
            Search
          </button>
        </form>
        {loading && <p role="status">Loading registered leagues…</p>}
        {searchResults.map((league) => (
          <div className="league-search-result" key={league.id}>
            <span>
              <strong>{league.displayName}</strong>
              <small>
                {league.leagueType === 'DRAFT' ? 'Draft' : 'Classic'} ·{' '}
                {scoringLabel(league.scoringType)}
                {league.privateLeague && ' · Private'}
                {league.ownerUserId === user.id && <OwnerBadge />}
              </small>
            </span>
            <button
              type="button"
              disabled={busy || league.followStatus === 'PENDING'}
              onClick={() => void onFollow(league)}
            >
              {league.followStatus === 'APPROVED'
                ? 'Open league'
                : league.followStatus === 'PENDING'
                  ? 'Pending approval'
                  : league.followStatus === 'REJECTED'
                    ? 'Request again'
                    : league.privateLeague
                      ? 'Request to follow'
                      : 'Follow'}
            </button>
          </div>
        ))}
        {noResults && <p className="empty-text">No registered leagues found.</p>}
      </div>
      {message && (
        <p role="alert" className="discovery-error">
          {message}{' '}
          <button type="button" onClick={onRetry}>
            Retry
          </button>
        </p>
      )}
      {pagination}
    </div>
  )
}
