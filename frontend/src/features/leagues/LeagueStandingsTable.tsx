import type { Navigate } from '../../app/useBrowserNavigation'
import { ImageButton } from './images/ImageButton'
import type { ImageRequest } from './images/imageData'
import { LeagueTeamLink } from './LeagueTeamLink'
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { useState } from 'react'
import type { FplLeagueScoring, LeagueDiscoveryState } from '../../shared/fpl/types'
import {
  managerName,
  recentMatchResults,
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
  liveForm = false,
  onImage,
}: {
  discovery: LeagueDiscoveryState
  scoringType: FplLeagueScoring
  teamLink: (id: number) => string
  navigate: Navigate
  liveForm?: boolean
  onImage: (request: ImageRequest) => void
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
              ? `League points decide rank. Fantasy points are cumulative player points. Form shows the last five ${liveForm ? 'matchups, including the provisional result' : 'completed matchups'}, newest on the right.`
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
        <ImageButton
          label="Create standings image"
          disabled={!standings.length || !discovery.gameweek}
          onClick={() => onImage({ kind: 'standings' })}
        />
      </header>
      <table className={`league-table league-standings-table${h2h ? ' league-h2h-table' : ''}`}>
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Club</th>
            <th scope="col" className="league-standings-image-column" aria-label="Club image" />
            <th scope="col" className="league-desktop-column">
              Movement
            </th>
            {h2h && (
              <th scope="col" className="league-form-column">
                Form
              </th>
            )}
            {h2h && (
              <th scope="col" className="league-desktop-column numeric">
                Fantasy points
              </th>
            )}
            <th scope="col" className="numeric">
              <span className="league-standings-points-label">
                {h2h ? 'League points' : 'Total points'}
              </span>
              <span className="league-mobile-detail" aria-hidden="true">
                Pts
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ standing, entry }) => {
            const last = standingLastRank(standing)
            const form = h2h
              ? recentMatchResults(discovery.details.matches, standingEntryId(standing), liveForm)
              : []
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
            const manager = entry
              ? managerName(entry.player_first_name, entry.player_last_name)
              : null
            const recentForm = (
              <span className="league-recent-form" role="group" aria-label="Recent form">
                {form.length ? (
                  form.map((match) => {
                    const outcome =
                      match.result === 'W' ? 'Win' : match.result === 'L' ? 'Loss' : 'Draw'
                    const label = `${match.provisional ? 'Provisional · ' : ''}Gameweek ${match.event}: ${outcome}, ${match.points}–${match.opponentPoints}`
                    return (
                      <span
                        key={match.id}
                        className={`league-form-bubble result-${match.result.toLowerCase()}`}
                        data-provisional={match.provisional}
                        role="img"
                        aria-label={label}
                        title={label}
                      >
                        {match.result}
                      </span>
                    )
                  })
                ) : (
                  <span className="league-form-empty">No completed results</span>
                )}
              </span>
            )
            const clubImage = (
              <ImageButton
                label={`Create club image for ${entry?.entry_name ?? 'club'}`}
                disabled={!discovery.gameweek}
                onClick={() => onImage({ kind: 'club', id: standingEntryId(standing) })}
              />
            )
            return (
              <tr key={standingEntryId(standing)}>
                <td className="league-standings-rank">
                  <span className={`league-rank rank-${standing.rank}`}>{standing.rank}</span>
                  <span className="league-mobile-detail">{movement}</span>
                </td>
                <td>
                  <div className="league-club-image-action">
                    <div className="league-standings-identity">
                      {entry ? (
                        <LeagueTeamLink
                          entryId={entry.entry_id}
                          href={teamLink(entry.entry_id)}
                          name={entry.entry_name}
                          navigate={navigate}
                        />
                      ) : (
                        <span className="league-standings-fallback">
                          Entry {standingEntryId(standing)}
                        </span>
                      )}
                      {manager && <small>{manager}</small>}
                    </div>
                    <span className="league-standings-desktop-image">{clubImage}</span>
                  </div>
                </td>
                <td className="league-standings-image-column">{clubImage}</td>
                <td className="league-desktop-column">{movement}</td>
                {h2h && <td className="league-form-column">{recentForm}</td>}
                {h2h && (
                  <td className="league-desktop-column numeric secondary-score">
                    {standingGamePoints(standing)}
                  </td>
                )}
                <td className="numeric">
                  <strong>{standingPoints(standing)}</strong>
                  {h2h && (
                    <small className="league-mobile-detail" aria-label="Fantasy points">
                      {standingGamePoints(standing)} FP
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
