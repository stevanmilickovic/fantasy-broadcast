import { useState } from 'react'
import type { FplLeagueType } from '../../shared/fpl/types'
import type { AuthUser } from '../auth/types'
import { scoringLabel } from './leagueData'
import { OwnerBadge } from './OwnerBadge'
import type { RegisteredLeague } from './types'
export function LeagueRegistrationForm({
  canRegisterLeague,
  leagueId,
  leagueType,
  busy,
  registrationMessage,
  searchMessage,
  searchResults,
  user,
  onLeagueIdChange,
  onLeagueTypeChange,
  onSubmit,
  onSearch,
  onFollow,
}: {
  canRegisterLeague: boolean
  leagueId: string
  leagueType: FplLeagueType
  busy: boolean
  registrationMessage: string | null
  searchMessage: string | null
  searchResults: RegisteredLeague[]
  user: AuthUser
  onLeagueIdChange: (value: string) => void
  onLeagueTypeChange: (value: FplLeagueType) => void
  onSubmit: (event: React.FormEvent) => void
  onSearch: (query: string) => void
  onFollow: (league: RegisteredLeague) => void
}) {
  const [query, setQuery] = useState('')
  if (!canRegisterLeague)
    return (
      <ClosedLeagueRegistrationScreen
        busy={busy}
        message={searchMessage}
        searchResults={searchResults}
        user={user}
        query={query}
        onQueryChange={setQuery}
        onSearch={onSearch}
        onFollow={onFollow}
      />
    )
  return (
    <section className="customer-empty league-onboarding">
      <div className="register-league-card">
        <span className="kicker">Create</span>
        <h1>Register a league</h1>
        <p>Enter your FPL league ID to add a league you manage.</p>
        <form onSubmit={onSubmit}>
          <label htmlFor="customer-league-id">League ID</label>
          <input
            id="customer-league-id"
            inputMode="numeric"
            value={leagueId}
            onChange={(event) => onLeagueIdChange(event.target.value)}
            required
          />
          <span className="league-type-label">League type</span>
          <div className="league-type-toggle" role="radiogroup">
            <button
              type="button"
              className={leagueType === 'DRAFT' ? 'selected' : ''}
              onClick={() => onLeagueTypeChange('DRAFT')}
            >
              Draft
            </button>
            <button
              type="button"
              className={leagueType === 'CLASSIC' ? 'selected' : ''}
              onClick={() => onLeagueTypeChange('CLASSIC')}
            >
              Classic
            </button>
          </div>
          <button type="submit" disabled={busy}>
            {busy ? 'Registering…' : 'Register my league'}
          </button>
          {registrationMessage && <p className="discovery-error">{registrationMessage}</p>}
        </form>
      </div>
      <LeagueSearchCard
        busy={busy}
        message={searchMessage}
        searchResults={searchResults}
        user={user}
        query={query}
        onQueryChange={setQuery}
        onSearch={onSearch}
        onFollow={onFollow}
      />
    </section>
  )
}

function LeagueSearchCard({
  busy,
  message,
  searchResults,
  user,
  query,
  onQueryChange,
  onSearch,
  onFollow,
}: {
  busy: boolean
  message: string | null
  searchResults: RegisteredLeague[]
  user: AuthUser
  query: string
  onQueryChange: (value: string) => void
  onSearch: (query: string) => void
  onFollow: (league: RegisteredLeague) => void
}) {
  const [hasSearched, setHasSearched] = useState(false)
  const noResults = hasSearched && !busy && searchResults.length === 0 && !message
  return (
    <div className="register-league-card find-league-card">
      <span className="kicker">Follow</span>
      <h1>Find a registered league</h1>
      <p>Search by league name or FPL ID, then follow it.</p>
      <div className="league-search">
        <div>
          <input
            id="registered-league-search"
            aria-label="League name or ID"
            value={query}
            onChange={(event) => {
              setHasSearched(false)
              onQueryChange(event.target.value)
            }}
            placeholder="League name or ID"
          />
          <button
            type="button"
            disabled={busy || !query.trim()}
            onClick={() => {
              setHasSearched(true)
              void onSearch(query)
            }}
          >
            Search
          </button>
        </div>
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
              {league.followStatus === 'PENDING'
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
      {message && <p className="discovery-error">{message}</p>}
    </div>
  )
}

function ClosedLeagueRegistrationScreen({
  busy,
  message,
  searchResults,
  user,
  query,
  onQueryChange,
  onSearch,
  onFollow,
}: {
  busy: boolean
  message: string | null
  searchResults: RegisteredLeague[]
  user: AuthUser
  query: string
  onQueryChange: (value: string) => void
  onSearch: (query: string) => void
  onFollow: (league: RegisteredLeague) => void
}) {
  return (
    <section className="customer-empty league-onboarding">
      <div className="register-league-card">
        <span className="kicker">Test access</span>
        <h1>League registration is closed</h1>
        <p>
          League registration is closed for this test. Search for the test league below and follow
          it to continue.
        </p>
      </div>
      <LeagueSearchCard
        busy={busy}
        message={message}
        searchResults={searchResults}
        user={user}
        query={query}
        onQueryChange={onQueryChange}
        onSearch={onSearch}
        onFollow={onFollow}
      />
    </section>
  )
}
