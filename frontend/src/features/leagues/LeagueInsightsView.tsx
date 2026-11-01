import { ArrowDownRight, ArrowUpRight, ChartNoAxesCombined } from 'lucide-react'
import { useState } from 'react'
import { TeamEmblem } from './TeamEmblem'
import type { Navigate } from '../../app/useBrowserNavigation'
import type { FplLeagueScoring, LeagueDiscoveryState } from '../../shared/fpl/types'
import { PlayerDetailsModal, type SelectedPlayer } from '../players/PlayerDetailsModal'
import { managerName } from './leagueData'
import {
  leagueInsights,
  rankInsightPlayers,
  type InsightMetric,
  type InsightPeriod,
} from './leagueInsights'
import { LeagueSelect } from './LeagueSelect'
import { LeagueTeamLink } from './LeagueTeamLink'

const metrics: Array<{ value: InsightMetric; label: string; unit: string }> = [
  { value: 'totalPoints', label: 'Fantasy points', unit: 'pts' },
  { value: 'goalsScored', label: 'Goals', unit: 'goals' },
  { value: 'assists', label: 'Assists', unit: 'assists' },
  { value: 'cleanSheets', label: 'Clean sheets', unit: 'clean sheets' },
]

export function LeagueInsightsView({
  discovery,
  scoringType,
  leagueId,
  teamLink,
  navigate,
}: {
  discovery: LeagueDiscoveryState
  scoringType: FplLeagueScoring
  leagueId: number
  teamLink: (id: number) => string
  navigate: Navigate
}) {
  const [period, setPeriod] = useState<InsightPeriod>('season')
  const [metric, setMetric] = useState<InsightMetric>('totalPoints')
  const [expanded, setExpanded] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<SelectedPlayer | null>(null)
  const insights = leagueInsights(discovery)
  const leaders = rankInsightPlayers(insights.players, period, metric)
  const seasonLeader = rankInsightPlayers(insights.players, 'season', 'totalPoints')[0]
  const weekLeader = rankInsightPlayers(insights.players, 'gameweek', 'totalPoints')[0]
  const bestBench = [...insights.clubs]
    .filter((club) => club.benchPoints != null && club.benchPoints > 0)
    .sort((a, b) => (b.benchPoints ?? 0) - (a.benchPoints ?? 0))[0]
  const climber = [...insights.clubs]
    .filter((club) => club.movement != null && club.movement > 0)
    .sort((a, b) => (b.movement ?? 0) - (a.movement ?? 0))[0]
  const coverage = insights.players.filter((player) => player[period] != null).length
  const selectedMetric = metrics.find((item) => item.value === metric) ?? metrics[0]
  const week = discovery.gameweek ? `Gameweek ${discovery.gameweek}` : 'Current gameweek'
  const highlights = [
    {
      title: 'Season points leader',
      name: seasonLeader?.player.webName,
      value: seasonLeader ? `${seasonLeader.value} pts` : '—',
      detail: seasonLeader?.player.premierLeagueClub ?? 'Season totals unavailable',
    },
    {
      title: 'Gameweek standout',
      name: weekLeader?.player.webName,
      value: weekLeader ? `${weekLeader.value} pts` : '—',
      detail: week,
    },
    {
      title: 'Bench firepower',
      name: bestBench?.entry.entry_name,
      value: bestBench ? `${bestBench.benchPoints} pts` : '—',
      detail: 'Highest raw bench total this gameweek',
      entryId: bestBench?.entry.entry_id,
    },
    {
      title: 'Biggest climb',
      name: climber?.entry.entry_name,
      value: climber ? `↑ ${climber.movement}` : '—',
      detail: 'Places gained since the previous table',
      entryId: climber?.entry.entry_id,
    },
  ]
  return (
    <section className="league-insights" aria-label="League insights">
      <header className="league-insights-intro">
        <div>
          <span className="kicker">Behind the table</span>
          <h2>Your league, in numbers</h2>
        </div>
        <span className="league-insights-week">
          <ChartNoAxesCombined size={16} aria-hidden="true" /> {week}
        </span>
      </header>

      <div className="league-insight-highlights">
        {highlights.map((highlight) => (
          <article className="league-insight-highlight" key={highlight.title}>
            <span>{highlight.title}</span>
            <strong>{highlight.value}</strong>
            <h3>
              {highlight.entryId && <TeamEmblem entryId={highlight.entryId} />}
              {highlight.name ?? 'No leader yet'}
            </h3>
            <small>{highlight.detail}</small>
          </article>
        ))}
      </div>

      <div className="league-insights-grid" data-h2h={scoringType === 'H2H'}>
        <section className="league-insight-panel" aria-labelledby="insight-player-title">
          <header className="league-panel-heading">
            <div>
              <h2 id="insight-player-title">Player leaders</h2>
              <p>Players currently owned in this league. Each player is counted once.</p>
            </div>
          </header>
          <div className="league-insight-filters">
            <div className="league-insight-period" role="group" aria-label="Player stats period">
              {(['season', 'gameweek'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={period === option}
                  onClick={() => {
                    setPeriod(option)
                    setExpanded(false)
                  }}
                >
                  {option === 'season' ? 'Season' : week}
                </button>
              ))}
            </div>
            <LeagueSelect
              label="Player statistic"
              value={metric}
              options={metrics}
              onChange={(value) => {
                setMetric(value)
                setExpanded(false)
              }}
            />
          </div>
          <ol className="league-insight-player-list" aria-label={`${selectedMetric.label} leaders`}>
            {(expanded ? leaders : leaders.slice(0, 5)).map(({ player, owners, value, rank }) => (
              <li key={player.id}>
                <span className="league-insight-rank">{rank}</span>
                <div className="league-insight-player">
                  <button
                    type="button"
                    onClick={() => setSelectedPlayer({ id: player.id, name: player.fullName })}
                    disabled={!discovery.gameweek}
                    aria-label={`View ${player.fullName} points`}
                  >
                    {player.webName}
                  </button>
                  <small>
                    {player.premierLeagueClub} · {player.position}
                  </small>
                  <span className="league-insight-owners">
                    {owners.length === 1 && <TeamEmblem entryId={owners[0].entry_id} />}
                    {owners.length === 1
                      ? owners[0].entry_name
                      : `${owners.length} clubs · ${Math.round((owners.length / insights.clubs.length) * 100)}% ownership`}
                  </span>
                </div>
                <strong className="league-insight-stat">
                  {value}
                  <small>{selectedMetric.unit}</small>
                </strong>
              </li>
            ))}
          </ol>
          {!leaders.length && (
            <p className="league-empty">
              {coverage
                ? `No ${selectedMetric.label.toLowerCase()} recorded yet.`
                : 'Player statistics are not available for this period yet.'}
            </p>
          )}
          {leaders.length > 5 && (
            <button
              type="button"
              className="league-insight-expand"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? 'Show top five' : `Show all ${leaders.length} players`}
            </button>
          )}
          <p className="league-insight-note">
            {period === 'season'
              ? 'FPL season totals for current squad members, including points earned before they joined a club.'
              : `${week} player totals, including benched players. No captain multipliers. Scores may change until FPL finalises the gameweek.`}
            {coverage < insights.players.length &&
              ` Statistics available for ${coverage} of ${insights.players.length} owned players.`}
          </p>
        </section>

        {scoringType === 'H2H' && (
          <section className="league-insight-panel" aria-labelledby="insight-performance-title">
            <header className="league-panel-heading">
              <div>
                <h2 id="insight-performance-title">Scoring vs results</h2>
                <p>Is a club’s league position keeping pace with its fantasy points?</p>
              </div>
            </header>
            <div className="league-insight-performance">
              {insights.performance.map((row) => (
                <article className="league-insight-performance-row" key={row.entry.entry_id}>
                  <div className="league-insight-club">
                    <LeagueTeamLink
                      entryId={row.entry.entry_id}
                      href={teamLink(row.entry.entry_id)}
                      name={row.entry.entry_name}
                      navigate={navigate}
                    />
                    <small>
                      {row.fantasyPoints} fantasy pts · {row.leaguePoints} league pts
                    </small>
                  </div>
                  <span
                    className="league-insight-gap"
                    data-direction={row.gap > 0 ? 'above' : row.gap < 0 ? 'below' : 'level'}
                  >
                    {row.gap > 0 ? (
                      <ArrowUpRight size={18} aria-hidden="true" />
                    ) : row.gap < 0 ? (
                      <ArrowDownRight size={18} aria-hidden="true" />
                    ) : null}
                    {row.gap === 0
                      ? 'In line'
                      : `${Math.abs(row.gap)} ${Math.abs(row.gap) === 1 ? 'place' : 'places'} ${row.gap > 0 ? 'ahead' : 'behind'}`}
                  </span>
                  <div className="league-insight-rank-compare">
                    <span>
                      Scoring rank <b>#{row.scoringRank}</b>
                    </span>
                    <span>
                      League rank <b>#{row.rank}</b>
                    </span>
                  </div>
                </article>
              ))}
              {!insights.performance.length && (
                <p className="league-empty">
                  Complete season scoring for at least two clubs is needed for this comparison.
                </p>
              )}
            </div>
            <p className="league-insight-note">
              Scoring rank sorts cumulative fantasy points; tied totals share a rank. “Ahead” means
              a better league position than scoring rank. This describes the table, not expected
              league points or a measure of luck.
            </p>
          </section>
        )}

        <section
          className="league-insight-panel league-insight-squads"
          aria-labelledby="insight-squad-title"
        >
          <header className="league-panel-heading">
            <div>
              <h2 id="insight-squad-title">Squad output</h2>
              <p>{week} · Starting XI and bench after recorded automatic substitutions.</p>
            </div>
          </header>
          <table className="league-insight-squad-table">
            <thead>
              <tr>
                <th scope="col">Club / manager</th>
                <th scope="col">XI pts</th>
                <th scope="col">Bench pts</th>
                <th scope="col">XI goals</th>
              </tr>
            </thead>
            <tbody>
              {[...insights.clubs]
                .sort((a, b) => (b.starterPoints ?? -Infinity) - (a.starterPoints ?? -Infinity))
                .map((club) => (
                  <tr key={club.entry.entry_id}>
                    <th scope="row">
                      <LeagueTeamLink
                        entryId={club.entry.entry_id}
                        href={teamLink(club.entry.entry_id)}
                        name={club.entry.entry_name}
                        navigate={navigate}
                      />
                      <small>
                        {managerName(club.entry.player_first_name, club.entry.player_last_name)}
                      </small>
                    </th>
                    <td>{club.starterPoints ?? '—'}</td>
                    <td>{club.benchPoints ?? '—'}</td>
                    <td>{club.goals ?? '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          {!insights.clubs.length && <p className="league-empty">No clubs available yet.</p>}
          <p className="league-insight-note">
            Raw player totals: captain multipliers, chips and transfer deductions are excluded.
            Bench points are not necessarily lost points. A dash means lineup or player data is
            incomplete.
          </p>
        </section>
      </div>
      <p className="league-insight-source">Based on the latest league data loaded from FPL.</p>
      {selectedPlayer && discovery.gameweek && (
        <PlayerDetailsModal
          player={selectedPlayer}
          leagueId={leagueId}
          gameweek={discovery.gameweek}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </section>
  )
}
