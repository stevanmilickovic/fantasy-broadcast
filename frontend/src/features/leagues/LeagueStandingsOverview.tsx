import type { Navigate } from '../../app/useBrowserNavigation'
import type { FplLeagueScoring, LeagueDiscoveryState } from '../../shared/fpl/types'
import { LeagueStandingsTable } from './LeagueStandingsTable'
import { LeagueTeamsView } from './LeagueTeamsView'
import { LeagueMatchupsView } from './LeagueMatchupsView'
import { LeagueInsightsView } from './LeagueInsightsView'

export function LeagueStandingsOverview({
  discovery,
  scoringType,
  leagueId,
  search,
  navigate,
}: {
  discovery: LeagueDiscoveryState
  scoringType: FplLeagueScoring
  leagueId: number
  search: string
  navigate: Navigate
}) {
  const params = new URLSearchParams(search)
  const tabs =
    scoringType === 'H2H'
      ? ['standings', 'teams', 'matchups', 'insights']
      : ['standings', 'teams', 'insights']
  const requested = params.get('view') ?? 'standings'
  const mode = tabs.includes(requested) ? requested : 'standings'
  const link = (view: string, entryId?: number, week?: number) =>
    `/league?${new URLSearchParams({ leagueId: String(leagueId), view, ...(entryId ? { entryId: String(entryId) } : {}), ...(week ? { week: String(week) } : {}) })}`
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
      <div
        className="league-view-content"
        key={mode}
        role="tabpanel"
        id={`league-panel-${mode}`}
        aria-labelledby={`league-tab-${mode}`}
      >
        {mode === 'insights' && (
          <LeagueInsightsView
            discovery={discovery}
            scoringType={scoringType}
            leagueId={leagueId}
            teamLink={(id) => link('teams', id)}
            navigate={navigate}
          />
        )}
        {mode === 'standings' && (
          <LeagueStandingsTable
            discovery={discovery}
            scoringType={scoringType}
            teamLink={(id) => link('teams', id)}
            navigate={navigate}
          />
        )}
        {mode === 'teams' && (
          <LeagueTeamsView
            discovery={discovery}
            leagueId={leagueId}
            selectedId={Number(params.get('entryId'))}
            onSelect={(id) => navigate(link('teams', id))}
          />
        )}
        {mode === 'matchups' && (
          <LeagueMatchupsView
            discovery={discovery}
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
