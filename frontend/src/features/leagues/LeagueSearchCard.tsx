import type { ReactNode } from 'react'
import type { AuthUser } from '../auth/types'
import { scoringLabel } from './leagueData'
import { OwnerBadge } from './OwnerBadge'
import type { RegisteredLeague } from './types'
import { Clock3 } from 'lucide-react'
export function LeagueSearchCard({
  busy,
  message,
  followError,
  searchResults,
  pagination,
  loading,
  onRetry,
  user,
  query,
  submittedQuery,
  onQueryChange,
  onSearch,
  onFollow,
}: {
  busy: boolean
  message: string | null
  followError?: { leagueId: number; message: string }
  searchResults: RegisteredLeague[]
  pagination: ReactNode
  loading: boolean
  onRetry: () => void
  user: AuthUser
  query: string
  submittedQuery: string
  onQueryChange: (value: string) => void
  onSearch: (query: string) => void
  onFollow: (league: RegisteredLeague) => void
}) {
  const noResults = !loading && searchResults.length === 0 && !message
  return (
    <div className="find-league-directory">
      <h1>Find leagues</h1>
      <div className="league-search">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            onSearch(query)
          }}
        >
          <input
            name="leagueSearch"
            autoComplete="off"
            spellCheck={false}
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
        {searchResults.length > 0 && (
          <ul className="league-search-results" role="list">
            {searchResults.map((league) => {
              const kind =
                league.followStatus === 'APPROVED'
                  ? 'open'
                  : league.followStatus === 'PENDING'
                    ? 'pending'
                    : league.privateLeague || league.followStatus === 'REJECTED'
                      ? 'request'
                      : 'follow'
              return (
                <li className="league-search-result" key={league.id}>
                  <span>
                    <strong>{league.displayName}</strong>
                    <small>
                      {league.leagueType === 'DRAFT' ? 'Draft' : 'Classic'} ·{' '}
                      {scoringLabel(league.scoringType)}
                      {league.privateLeague && ' · Private'}
                      {league.ownerUserId === user.id && <OwnerBadge />}
                    </small>
                  </span>
                  {kind === 'open' ? (
                    <a
                      className="league-result-action"
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
                        onFollow(league)
                      }}
                    >
                      Open league
                    </a>
                  ) : kind === 'pending' ? (
                    <span className="league-result-pending">
                      <Clock3 size={16} aria-hidden="true" />
                      Pending approval
                    </span>
                  ) : (
                    <button
                      className="secondary-action league-result-action"
                      type="button"
                      disabled={busy}
                      onClick={() => onFollow(league)}
                    >
                      {league.followStatus === 'REJECTED'
                        ? 'Request again'
                        : kind === 'request'
                          ? 'Request to follow'
                          : 'Follow'}
                    </button>
                  )}
                  {followError?.leagueId === league.id && (
                    <p className="league-result-error discovery-error" role="alert">
                      {followError.message}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {noResults && (
          <p className="empty-text">
            {submittedQuery ? 'No leagues match this search.' : 'No registered leagues found.'}
          </p>
        )}
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
