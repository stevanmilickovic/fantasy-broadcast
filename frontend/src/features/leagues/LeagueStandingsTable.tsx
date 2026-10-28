import type { Navigate } from '../../app/useBrowserNavigation'
import { LeagueTeamLink } from './LeagueTeamLink'
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { useState } from 'react'
import type { FplLeagueScoring, LeagueDiscoveryState } from '../../shared/fpl/types'
import {
  managerName,
  standingEntryId,
  standingGamePoints,
  standingLastRank,
  standingPoints,
} from './leagueData'

export function LeagueStandingsTable({
  discovery,
  scoringType,
  teamLink,
  navigate,
}: {
  discovery: LeagueDiscoveryState
  scoringType: FplLeagueScoring
  teamLink: (id: number) => string
  navigate: Navigate
}) {
  const [search, setSearch] = useState('')
  const entries = discovery.details.league_entries
  const standings = [...discovery.details.standings].sort(
    (a, b) => a.rank - b.rank || standingPoints(b) - standingPoints(a),
  )
  const h2h = scoringType === 'H2H'
  const rows = standings
    .map((standing) => ({
      standing,
      entry: entries.find(
        (entry) =>
          entry.id === standingEntryId(standing) || entry.entry_id === standingEntryId(standing),
      ),
    }))
    .filter(
      ({ entry }) =>
        !search ||
        `${entry?.entry_name} ${entry?.player_first_name} ${entry?.player_last_name}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
  return (
    <section className="league-table-panel">
      <header className="league-panel-heading">
        <div>
          <h2>League standings</h2>
          <p>
            {h2h
              ? 'League points decide rank. Fantasy points are cumulative player points.'
              : 'Ranked by total fantasy points.'}
          </p>
        </div>
        {standings.length > 10 && (
          <label>
            Search clubs
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              type="search"
            />
          </label>
        )}
      </header>
      <table className="league-table">
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Club</th>
            <th scope="col" className="league-desktop-column">
              Movement
            </th>
            {h2h && (
              <th scope="col" className="league-desktop-column numeric">
                Fantasy points
              </th>
            )}
            <th scope="col" className="numeric">
              {h2h ? 'League points' : 'Total points'}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ standing, entry }) => {
            const last = standingLastRank(standing)
            const delta = last ? last - standing.rank : null
            const Icon = delta === null || delta === 0 ? Minus : delta > 0 ? ArrowUp : ArrowDown
            const movement = (
              <span
                className={`league-movement ${delta && delta > 0 ? 'up' : delta && delta < 0 ? 'down' : 'unchanged'}`}
                aria-hidden={!delta}
                aria-label={
                  delta === null
                    ? 'Previous rank unavailable'
                    : delta === 0
                      ? 'No movement'
                      : `${delta > 0 ? 'Up' : 'Down'} ${Math.abs(delta)} places`
                }
              >
                <Icon size={14} />
                {delta ? Math.abs(delta) : '—'}
              </span>
            )
            return (
              <tr key={standingEntryId(standing)}>
                <td>
                  <span className={`league-rank rank-${standing.rank}`}>{standing.rank}</span>
                  <span className="league-mobile-detail">{movement}</span>
                </td>
                <td>
                  {entry ? (
                    <LeagueTeamLink
                      href={teamLink(entry.entry_id)}
                      name={entry.entry_name}
                      navigate={navigate}
                    />
                  ) : (
                    `Entry ${standingEntryId(standing)}`
                  )}
                  <small>
                    {entry && managerName(entry.player_first_name, entry.player_last_name)}
                  </small>
                </td>
                <td className="league-desktop-column">{movement}</td>
                {h2h && (
                  <td className="league-desktop-column numeric secondary-score">
                    {standingGamePoints(standing)}
                  </td>
                )}
                <td className="numeric">
                  <strong>{standingPoints(standing)}</strong>
                  {h2h && (
                    <small className="league-mobile-detail">
                      {standingGamePoints(standing)} fantasy pts
                    </small>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {!rows.length && (
        <p className="league-empty">
          {search ? 'No clubs match your search.' : 'No standings returned by FPL yet.'}
        </p>
      )}
    </section>
  )
}
