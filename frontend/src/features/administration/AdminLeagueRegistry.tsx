import type { FplLeagueScoring, FplLeagueType } from '../../shared/fpl/types'
import { useAdminLeagueRegistry } from './useAdminLeagueRegistry'

type Props = { onOpenLeague: (leagueId: number) => void }

export function AdminLeagueRegistry({ onOpenLeague }: Props) {
  const {
    page,
    setPage,
    pageSize,
    setPageSize,
    leagueId,
    setLeagueId,
    leagueType,
    setLeagueType,
    searchInput,
    setSearchInput,
    search,
    setSearch,
    message,
    busy,
    query,
    leagues,
    totalItems,
    submit,
    save,
    updateLeagueFlag,
    totalPages,
  } = useAdminLeagueRegistry()
  return (
    <section className="league-discovery admin-registry">
      {query.status === 'loading' && <p>Loading…</p>}
      {query.error && (
        <p className="discovery-error" role="alert">
          {query.error}
        </p>
      )}
      <div className="discovery-form">
        <div>
          <span className="kicker">Administrator</span>
          <h2>League settings</h2>
        </div>
        <form className="administration-register-form" onSubmit={submit}>
          <div className="administration-form-field">
            <label>FPL league ID</label>
            <input
              inputMode="numeric"
              value={leagueId}
              onChange={(event) => setLeagueId(event.target.value)}
              required
            />
          </div>
          <div className="administration-form-field">
            <span>League type</span>
            <select
              className="administration-select"
              value={leagueType}
              onChange={(event) => setLeagueType(event.target.value as FplLeagueType)}
            >
              <option value="DRAFT">Draft</option>
              <option value="CLASSIC">Classic</option>
            </select>
          </div>
          <button disabled={busy}>Register</button>
        </form>
      </div>
      {message && (
        <p
          className={
            message === 'League registered.' ? 'broadcast-schedule-success' : 'discovery-error'
          }
        >
          {message}
        </p>
      )}
      <form
        className="admin-league-search"
        onSubmit={(event) => {
          event.preventDefault()
          setPage(0)
          setSearch(searchInput.trim())
        }}
      >
        <label htmlFor="admin-league-search">Find a league</label>
        <input
          id="admin-league-search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search by league name or FPL ID"
        />
        <button type="submit" className="secondary-action">
          Search
        </button>
        {search && (
          <button
            type="button"
            className="secondary-action"
            onClick={() => {
              setSearchInput('')
              setSearch('')
              setPage(0)
            }}
          >
            Clear
          </button>
        )}
      </form>
      <div className="admin-league-table">
        {leagues.map((league) => (
          <div
            className="admin-league-row"
            key={league.id}
            onDoubleClick={() => onOpenLeague(league.id)}
            title="Double-click to open this league"
          >
            <strong>{league.displayName}</strong>
            <span>
              {league.leagueType} · {scoringLabel(league.scoringType)} · #{league.fplLeagueId}
            </span>
            <span>Owner: {league.ownerEmail ?? '—'}</span>
            <label className="league-enabled">
              <input
                type="checkbox"
                checked={league.serviceEnabled}
                onChange={(event) =>
                  updateLeagueFlag(league.id, { serviceEnabled: event.target.checked })
                }
              />{' '}
              Service enabled
            </label>
            <label className="league-enabled">
              <input
                type="checkbox"
                checked={league.aiNarrationEnabled}
                onChange={(event) =>
                  updateLeagueFlag(league.id, {
                    aiNarrationEnabled: event.target.checked,
                    voiceNarrationEnabled: event.target.checked
                      ? league.voiceNarrationEnabled
                      : false,
                  })
                }
              />{' '}
              AI text
            </label>
            <label className="league-enabled">
              <input
                type="checkbox"
                checked={league.voiceNarrationEnabled}
                disabled={!league.aiNarrationEnabled}
                onChange={(event) =>
                  updateLeagueFlag(league.id, { voiceNarrationEnabled: event.target.checked })
                }
              />{' '}
              Voice
            </label>
            <small>Registered {new Date(league.createdAt).toLocaleString()}</small>
            <button onClick={() => void save(league)} disabled={busy}>
              Save settings
            </button>
          </div>
        ))}
      </div>
      {query.status === 'success' && totalItems === 0 && (
        <p className="empty-text">No leagues match this search.</p>
      )}
      {totalItems > 0 && (
        <nav className="admin-pagination" aria-label="League settings pages">
          <label>
            Per page{' '}
            <select
              value={pageSize}
              disabled={busy}
              onChange={(event) => {
                setPageSize(Number(event.target.value))
                setPage(0)
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
          <button
            className="secondary-action"
            disabled={page === 0 || busy}
            onClick={() => setPage((current) => current - 1)}
          >
            Previous
          </button>
          <span>
            Page {page + 1} of {totalPages} · {totalItems} leagues
          </span>
          <button
            className="secondary-action"
            disabled={page + 1 >= totalPages || busy}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </section>
  )
}

function scoringLabel(scoringType: FplLeagueScoring) {
  return scoringType === 'H2H' ? 'Head-to-head' : 'Total points'
}
