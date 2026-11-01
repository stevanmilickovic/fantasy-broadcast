import type { Navigate } from '../../app/useBrowserNavigation'
import { LeagueTeamLink } from './LeagueTeamLink'
import { LeagueSelect } from './LeagueSelect'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import type { LeagueDiscoveryState } from '../../shared/fpl/types'
import { groupedMatches, managerName } from './leagueData'

export function LeagueMatchupsView({
  discovery,
  selectedWeek,
  onSelectWeek,
  teamLink,
  navigate,
}: {
  discovery: LeagueDiscoveryState
  selectedWeek: number
  onSelectWeek: (week: number) => void
  teamLink: (id: number) => string
  navigate: Navigate
}) {
  const weeks = groupedMatches([...discovery.details.matches].sort((a, b) => a.event - b.event))
  const week =
    weeks.find((week) => week.event === selectedWeek) ??
    weeks.find((week) => week.event === discovery.gameweek) ??
    weeks.find((week) => week.matches.some((match) => !match.finished)) ??
    weeks.at(-1)
  if (!week) return <p className="league-empty">No matchups returned by FPL yet.</p>
  const index = weeks.indexOf(week)
  return (
    <section className="league-matchups-view">
      <div className="league-week-control">
        <div>
          <span className="kicker">The matchday</span>
          <h2>Head-to-head matchups</h2>
        </div>
        <div>
          <button
            aria-label="Previous gameweek"
            disabled={index === 0}
            onClick={() => onSelectWeek(weeks[index - 1].event)}
          >
            <ChevronLeft size={18} />
          </button>
          <div className="league-select-field league-week-field">
            <span>Gameweek</span>
            <LeagueSelect
              label="Gameweek"
              value={week.event}
              onChange={onSelectWeek}
              icon={<CalendarDays size={17} aria-hidden="true" />}
              options={weeks.map((week) => ({
                value: week.event,
                label: `Gameweek ${week.event}`,
              }))}
            />
          </div>
          <button
            aria-label="Next gameweek"
            disabled={index === weeks.length - 1}
            onClick={() => onSelectWeek(weeks[index + 1].event)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <section className="matchweek-group">
        <header>Gameweek {week.event}</header>
        <div className="league-matchup-grid">
          {week.matches.map((match) => {
            const ids = [
              match.league_entry_1 ?? match.firstLeagueEntryId,
              match.league_entry_2 ?? match.secondLeagueEntryId,
            ]
            const points = [
              match.league_entry_1_points ?? match.firstPoints,
              match.league_entry_2_points ?? match.secondPoints,
            ]
            const upcoming = !match.finished && week.event > (discovery.gameweek ?? week.event)
            return (
              <article className="league-matchup-card" key={match.id}>
                <div className="league-matchup-scoreboard">
                  {ids.map((id, side) => {
                    const entry = discovery.details.league_entries.find(
                      (entry) => entry.id === id || entry.entry_id === id,
                    )
                    const score = points[side]
                    const opponentScore = points[1 - side]
                    const decided =
                      match.finished && score !== undefined && opponentScore !== undefined
                    const winner = decided && score > opponentScore
                    const loser = decided && score < opponentScore
                    return (
                      <div
                        className={`league-matchup-club ${winner ? 'winner' : loser ? 'loser' : ''} ${side === 0 ? 'first-club' : 'second-club'}`}
                        key={side}
                      >
                        <div>
                          {entry ? (
                            <LeagueTeamLink
                              entryId={entry.entry_id}
                              href={teamLink(entry.entry_id)}
                              name={entry.entry_name}
                              navigate={navigate}
                            />
                          ) : (
                            `Entry ${id ?? 'unavailable'}`
                          )}
                          <small>
                            {entry && managerName(entry.player_first_name, entry.player_last_name)}
                          </small>
                        </div>
                        <strong>{upcoming ? '—' : (points[side] ?? '—')}</strong>
                      </div>
                    )
                  })}
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </section>
  )
}
