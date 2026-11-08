import type { Navigate } from '../../app/useBrowserNavigation'
import type { FplLeagueScoring, LeagueDiscoveryState } from '../../shared/fpl/types'
import { LeagueStandingsTable } from './LeagueStandingsTable'
import { LeagueTeamsView } from './LeagueTeamsView'
import { LeagueMatchupsView } from './LeagueMatchupsView'
import { LeagueInsightsView } from './LeagueInsightsView'
import { LeagueChat } from '../chat/LeagueChat'
import { useEffect, useRef } from 'react'
import { useLiveLeague } from './useLiveLeague'
import { withLiveLeague } from './liveLeagueData'

export function LeagueStandingsOverview({
  discovery,
  scoringType,
  leagueId,
  search,
  navigate,
  onRefresh,
}: {
  discovery?: LeagueDiscoveryState
  scoringType: FplLeagueScoring
  leagueId: number
  search: string
  navigate: Navigate
  onRefresh?: () => void
}) {
  const params = new URLSearchParams(search)
  const tabs =
    scoringType === 'H2H'
      ? ['standings', 'teams', 'matchups', 'insights', 'chat']
      : ['standings', 'teams', 'insights', 'chat']
  const requested = params.get('view') ?? 'standings'
  const mode = tabs.includes(requested) ? requested : 'standings'
  const liveStandings = params.get('standings') === 'live'
  const live = useLiveLeague(leagueId, mode === 'standings' || mode === 'matchups')
  const refreshedSnapshot = useRef<string | null>(null)
  const displayed = discovery ? withLiveLeague(discovery, live.data, liveStandings) : discovery
  const sameWeek = live.data?.gameweek === discovery?.gameweek
  const showingLive =
    liveStandings &&
    sameWeek &&
    !live.data?.standingsUnavailableReason &&
    Boolean(live.data?.standings.length)
  const stale = Boolean(
    live.error ||
    (live.data &&
      live.checkedAt &&
      (live.checkedAt - Date.parse(live.data.pointsFetchedAt) > 30_000 ||
        live.checkedAt - Date.parse(live.data.fixturesFetchedAt) > 60_000)),
  )
  useEffect(() => {
    if (live.data && discovery?.gameweek && live.data.gameweek !== discovery.gameweek) {
      const key = `${live.data.gameweek}:${live.data.pointsFetchedAt}`
      if (refreshedSnapshot.current !== key) {
        refreshedSnapshot.current = key
        onRefresh?.()
      }
    }
  }, [live.data, discovery?.gameweek, onRefresh])
  const link = (view: string, entryId?: number, week?: number) =>
    `/league?${new URLSearchParams({ leagueId: String(leagueId), view, ...(liveStandings ? { standings: 'live' } : {}), ...(entryId ? { entryId: String(entryId) } : {}), ...(week ? { week: String(week) } : {}) })}`
  return (
    <section className="selected-league-standings">
      <div className="league-view-toggle" role="tablist" aria-label="League display">
        {tabs.map((tab, index) => (
          <button
            key={tab}
            id={`league-tab-${tab}`}
            role="tab"
            aria-selected={mode === tab}
            aria-controls={`league-panel-${tab}`}
            tabIndex={mode === tab ? 0 : -1}
            onClick={() => navigate(link(tab))}
            onKeyDown={(event) => {
              const next =
                event.key === 'ArrowRight'
                  ? (index + 1) % tabs.length
                  : event.key === 'ArrowLeft'
                    ? (index + tabs.length - 1) % tabs.length
                    : event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? tabs.length - 1
                        : undefined
              if (next !== undefined) {
                event.preventDefault()
                navigate(link(tabs[next]))
                document.getElementById(`league-tab-${tabs[next]}`)?.focus()
              }
            }}
          >
            {tab[0].toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>
      {(mode === 'standings' || mode === 'matchups') && (
        <aside className="league-live-status">
          {mode === 'standings' && (
            <div role="group" aria-label="Standings source">
              {(['fpl', 'live'] as const).map((source) => (
                <button
                  key={source}
                  type="button"
                  aria-pressed={source === 'live' ? liveStandings : !liveStandings}
                  onClick={() => {
                    const next = new URLSearchParams(params)
                    next.set('leagueId', String(leagueId))
                    if (source === 'live') next.set('standings', 'live')
                    else next.delete('standings')
                    navigate(`/league?${next}`)
                  }}
                >
                  {source === 'fpl' ? 'FPL' : 'Live'}
                </button>
              ))}
            </div>
          )}
          <p>
            {live.error
              ? `Live update unavailable. ${live.data ? 'Last received values are stale.' : 'FPL values shown.'}`
              : live.data && sameWeek
                ? `${live.data.status === 'LIVE' ? 'Live' : live.data.status === 'FINAL' ? 'Final' : live.data.status === 'UPCOMING' ? 'Upcoming' : 'Provisional'} gameweek scores${stale ? ' · Stale' : ''}.`
                : 'Checking current gameweek scores…'}
            {live.data && (
              <>
                {' '}
                Points received{' '}
                <time dateTime={live.data.pointsFetchedAt}>
                  {new Date(live.data.pointsFetchedAt).toLocaleTimeString()}
                </time>
                .
              </>
            )}
            {mode === 'standings' && (
              <>
                {' '}
                {showingLive
                  ? 'Live standings are provisional until FPL settles the gameweek.'
                  : 'FPL standings shown.'}
              </>
            )}
          </p>
          {(live.error ||
            live.data?.scoresUnavailableReason ||
            (liveStandings && live.data?.standingsUnavailableReason)) && (
            <p>
              {live.data?.scoresUnavailableReason ??
                (liveStandings ? live.data?.standingsUnavailableReason : null) ??
                live.error}{' '}
              <button type="button" onClick={live.refresh}>
                Retry live update
              </button>
            </p>
          )}
        </aside>
      )}
      <div
        className="league-view-content"
        key={mode}
        role="tabpanel"
        id={`league-panel-${mode}`}
        aria-labelledby={`league-tab-${mode}`}
      >
        {mode === 'chat' && <LeagueChat key={leagueId} leagueId={leagueId} />}
        {mode === 'insights' && discovery && (
          <LeagueInsightsView
            discovery={discovery}
            scoringType={scoringType}
            leagueId={leagueId}
            teamLink={(id) => link('teams', id)}
            navigate={navigate}
          />
        )}
        {mode === 'standings' && discovery && (
          <LeagueStandingsTable
            liveForm={Boolean(showingLive)}
            discovery={displayed ?? discovery}
            scoringType={scoringType}
            teamLink={(id) => link('teams', id)}
            navigate={navigate}
          />
        )}
        {mode === 'teams' && discovery && (
          <LeagueTeamsView
            discovery={discovery}
            leagueId={leagueId}
            selectedId={Number(params.get('entryId'))}
            onSelect={(id) => navigate(link('teams', id))}
          />
        )}
        {mode === 'matchups' && discovery && (
          <LeagueMatchupsView
            discovery={displayed ?? discovery}
            selectedWeek={Number(params.get('week'))}
            onSelectWeek={(week) => navigate(link('matchups', undefined, week))}
            teamLink={(id) => link('teams', id)}
            navigate={navigate}
          />
        )}
      </div>
    </section>
  )
}
