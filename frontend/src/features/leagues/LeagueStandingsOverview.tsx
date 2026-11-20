import type { Navigate } from '../../app/useBrowserNavigation'
import type { FplClubShirt, FplLeagueScoring, LeagueDiscoveryState } from '../../shared/fpl/types'
import type { PlayerDetails } from '../players/types'
import { LeagueStandingsTable } from './LeagueStandingsTable'
import { LeagueTeamsView } from './LeagueTeamsView'
import { LeagueMatchupsView } from './LeagueMatchupsView'
import { LeagueInsightsView } from './LeagueInsightsView'
import { LeagueChat } from '../chat/LeagueChat'
import { useEffect, useRef, useState } from 'react'
import { useTeamEmblems } from './teamEmblems'
import { createLeagueImage, type ImageRequest, type LeagueImage } from './images/imageData'
import { LeagueImageDialog } from './images/LeagueImageDialog'
import { useLiveLeague } from './useLiveLeague'
import { withLiveLeague } from './liveLeagueData'

export function LeagueStandingsOverview({
  discovery,
  scoringType,
  leagueId,
  leagueName,
  search,
  navigate,
  onRefresh,
  sample,
}: {
  discovery?: LeagueDiscoveryState
  scoringType: FplLeagueScoring
  leagueName: string
  search: string
  navigate: Navigate
  onRefresh?: () => void
} & (
  | { leagueId: number; sample?: never }
  | {
      leagueId?: never
      sample: { shirtCodes: FplClubShirt[]; playerDetails: Record<number, PlayerDetails> }
    }
)) {
  const [image, setImage] = useState<LeagueImage>()
  const emblems = useTeamEmblems()
  const params = new URLSearchParams(search)
  const tabs = sample
    ? ['standings', 'teams', 'matchups']
    : scoringType === 'H2H'
      ? ['standings', 'teams', 'matchups', 'insights', 'chat']
      : ['standings', 'teams', 'insights', 'chat']
  const requested = params.get('view') ?? 'standings'
  const mode = tabs.includes(requested) ? requested : 'standings'
  const liveStandings = !sample && params.get('standings') === 'live'
  const liveMatchups = !sample && params.get('matchups') === 'live'
  const liveResults = mode === 'matchups' ? liveMatchups : liveStandings
  const live = useLiveLeague(leagueId, mode === 'standings' || mode === 'matchups')
  const refreshedSnapshot = useRef<string | null>(null)
  const displayed = discovery
    ? withLiveLeague(discovery, live.data, liveStandings, liveResults)
    : discovery
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
  const openImage = (request: ImageRequest) => {
    if (!displayed?.gameweek) return
    setImage(
      createLeagueImage({
        request,
        discovery: displayed,
        league: leagueName,
        scoring: scoringType,
        emblems: emblems.teams,
        live: live.data,
        liveSelected: liveResults,
        resultsSource: sample ? 'Sample results' : 'FPL',
        stale,
      }),
    )
  }
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
    `${sample ? '/preview-league' : '/league'}?${new URLSearchParams({ ...(sample ? {} : { leagueId: String(leagueId) }), view, ...(liveStandings ? { standings: 'live' } : {}), ...(liveMatchups ? { matchups: 'live' } : {}), ...(entryId ? { entryId: String(entryId) } : {}), ...(week ? { week: String(week) } : {}) })}`
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
      {!sample && (mode === 'standings' || mode === 'matchups') && (
        <aside className="league-live-status">
          <div
            role="group"
            aria-label={mode === 'matchups' ? 'Matchups source' : 'Standings source'}
          >
            {(['fpl', 'live'] as const).map((source) => (
              <button
                key={source}
                type="button"
                aria-pressed={source === 'live' ? liveResults : !liveResults}
                onClick={() => {
                  const next = new URLSearchParams(params)
                  next.set('leagueId', String(leagueId))
                  const key = mode === 'matchups' ? 'matchups' : 'standings'
                  if (source === 'live') next.set(key, 'live')
                  else next.delete(key)
                  navigate(`/league?${next}`)
                }}
              >
                {source === 'fpl' ? 'FPL' : 'Live'}
              </button>
            ))}
          </div>
          {liveResults ? (
            <>
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
                (mode === 'standings' && live.data?.standingsUnavailableReason)) && (
                <p>
                  {live.data?.scoresUnavailableReason ??
                    (mode === 'standings' ? live.data?.standingsUnavailableReason : null) ??
                    live.error}{' '}
                  <button type="button" onClick={live.refresh}>
                    Retry live update
                  </button>
                </p>
              )}
            </>
          ) : (
            <p>{mode === 'matchups' ? 'FPL results shown.' : 'FPL standings shown.'}</p>
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
        {mode === 'chat' && leagueId !== undefined && (
          <LeagueChat key={leagueId} leagueId={leagueId} />
        )}
        {mode === 'insights' && discovery && leagueId !== undefined && (
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
            onImage={openImage}
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
            shirtCodes={sample?.shirtCodes}
            samplePlayerDetails={sample?.playerDetails}
            selectedId={Number(params.get('entryId'))}
            onSelect={(id) => navigate(link('teams', id))}
          />
        )}
        {mode === 'matchups' && discovery && (
          <LeagueMatchupsView
            onImage={openImage}
            discovery={displayed ?? discovery}
            selectedWeek={Number(params.get('week'))}
            onSelectWeek={(week) => navigate(link('matchups', undefined, week))}
            teamLink={(id) => link('teams', id)}
            navigate={navigate}
          />
        )}
      </div>
      {image && <LeagueImageDialog image={image} onDismiss={() => setImage(undefined)} />}
    </section>
  )
}
