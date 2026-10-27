import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { FplLeagueScoring, FplStanding, LeagueDiscoveryState } from '../../shared/fpl/types'
import { useShirtCodes } from '../../shared/fpl/useShirtCodes'
import {
  groupedMatches,
  groupedStandings,
  managerName,
  placeLabel,
  standingEntryId,
  standingGamePoints,
  standingLastRank,
  standingPoints,
} from './leagueData'
import { LeagueTeamVisual } from './LeagueTeamVisual'
type LeagueDisplayMode = 'standings' | 'teams' | 'matchups'

export function LeagueStandingsOverview({
  discovery,
  scoringType,
  leagueId,
}: {
  discovery: LeagueDiscoveryState
  scoringType: FplLeagueScoring
  leagueId?: number
}) {
  const [mode, setMode] = useState<LeagueDisplayMode>('standings')
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null)
  const [teamSearch, setTeamSearch] = useState('')
  const [hasManagerOverflow, setHasManagerOverflow] = useState(false)
  const managerListRef = useRef<HTMLDivElement>(null)
  const shirtCodes = useShirtCodes()
  const { details } = discovery
  const showGamePoints = scoringType === 'H2H'
  const entries = details.league_entries ?? []
  const entriesByLeagueEntryId = new Map(entries.map((entry) => [entry.id, entry]))
  const entriesByEntryId = new Map(entries.map((entry) => [entry.entry_id, entry]))
  const selectedEntry = entries.find((entry) => entry.entry_id === selectedEntryId) ?? null
  const standings = (details.standings ?? [])
    .slice()
    .sort(
      (first, second) => first.rank - second.rank || standingPoints(second) - standingPoints(first),
    )
  const podiumGroups = groupedStandings(standings).slice(0, 3)
  const podiumEntryIds = new Set(
    podiumGroups.flatMap((group) => group.standings.map(standingEntryId)),
  )
  const remainingStandings = standings.filter(
    (standing) => !podiumEntryIds.has(standingEntryId(standing)),
  )
  const matches = (details.matches ?? [])
    .slice()
    .sort((first, second) => first.event - second.event)
  const matchweeks = groupedMatches(matches)
  const currentGameweek =
    discovery.gameweek ??
    matchweeks.find((week) => week.matches.some((match) => !match.finished))?.event ??
    matchweeks.at(-1)?.event
  const previousMatchweeks = matchweeks.filter(
    (week) => currentGameweek !== undefined && week.event < currentGameweek,
  )
  const currentMatchweek = matchweeks.find((week) => week.event === currentGameweek)
  const futureMatchweeks = matchweeks.filter(
    (week) => currentGameweek !== undefined && week.event > currentGameweek,
  )
  const renderMatchweek = (week: (typeof matchweeks)[number]) => (
    <section className="matchweek-group" key={week.event}>
      <header>
        <strong>Gameweek {week.event}</strong>
      </header>
      <div>
        {week.matches.map((match, index) => {
          const firstEntryId = match.league_entry_1 ?? match.firstLeagueEntryId ?? 0
          const secondEntryId = match.league_entry_2 ?? match.secondLeagueEntryId ?? 0
          const firstEntry =
            entriesByLeagueEntryId.get(firstEntryId) ?? entriesByEntryId.get(firstEntryId)
          const secondEntry =
            entriesByLeagueEntryId.get(secondEntryId) ?? entriesByEntryId.get(secondEntryId)
          const firstPoints = match.league_entry_1_points ?? match.firstPoints ?? 0
          const secondPoints = match.league_entry_2_points ?? match.secondPoints ?? 0
          const played = match.finished || firstPoints > 0 || secondPoints > 0
          const firstResultClass =
            !played || firstPoints === secondPoints
              ? ''
              : firstPoints > secondPoints
                ? 'winning-score'
                : 'losing-score'
          const secondResultClass =
            !played || firstPoints === secondPoints
              ? ''
              : secondPoints > firstPoints
                ? 'winning-score'
                : 'losing-score'
          return (
            <article
              className={`league-matchup-row ${played ? 'played' : 'upcoming'}`}
              key={`${match.event}-${firstEntryId}-${secondEntryId}-${index}`}
            >
              <strong className="matchup-team home-team">
                {firstEntry?.entry_name ?? firstEntryId}
              </strong>
              <div
                className="matchup-scoreline"
                aria-label={played ? `${firstPoints} versus ${secondPoints}` : 'Upcoming matchup'}
              >
                <span className={firstResultClass}>{played ? firstPoints : '-'}</span>
                <b>vs</b>
                <span className={secondResultClass}>{played ? secondPoints : '-'}</span>
              </div>
              <strong className="matchup-team away-team">
                {secondEntry?.entry_name ?? secondEntryId}
              </strong>
            </article>
          )
        })}
      </div>
    </section>
  )
  const filteredEntries = entries.filter((entry) => {
    const query = teamSearch.trim().toLowerCase()
    if (!query) return true
    return `${entry.entry_name} ${entry.player_first_name} ${entry.player_last_name}`
      .toLowerCase()
      .includes(query)
  })

  useEffect(() => {
    const element = managerListRef.current
    if (!element || mode !== 'teams') return
    const updateOverflow = () =>
      setHasManagerOverflow(element.scrollHeight > element.clientHeight + 1)
    const observer = new ResizeObserver(updateOverflow)
    observer.observe(element)
    updateOverflow()
    return () => observer.disconnect()
  }, [mode, entries.length])

  return (
    <section className="selected-league-standings">
      <header className="selected-league-heading">
        <h1>{details.league?.name ?? 'League standings'}</h1>
        <div className="league-view-toggle" role="tablist" aria-label="League display">
          <button
            type="button"
            className={mode === 'standings' ? 'selected' : ''}
            onClick={() => setMode('standings')}
          >
            Standings
          </button>
          <button
            type="button"
            className={mode === 'teams' ? 'selected' : ''}
            onClick={() => setMode('teams')}
          >
            Teams
          </button>
          {showGamePoints && (
            <button
              type="button"
              className={mode === 'matchups' ? 'selected' : ''}
              onClick={() => setMode('matchups')}
            >
              Matchups
            </button>
          )}
        </div>
      </header>

      {mode === 'standings' &&
        (standings.length === 0 ? (
          <p className="empty-text compact-empty">No standings returned by FPL yet.</p>
        ) : (
          <>
            <div className="standings-podium" aria-label="Top standings podium">
              {podiumGroups.map((group, index) => (
                <article className={`podium-step podium-step-${index + 1}`} key={group.rank}>
                  <div className="podium-entries">
                    {group.standings.map((standing) => {
                      const entryId = standing.league_entry ?? standing.leagueEntryId ?? 0
                      const entry =
                        entriesByLeagueEntryId.get(entryId) ?? entriesByEntryId.get(entryId)
                      return (
                        <div className="podium-entry" key={entryId}>
                          <strong>{entry?.entry_name ?? `Entry ${entryId}`}</strong>
                          <div className="podium-entry-meta">
                            {showGamePoints && <i className="podium-points-divider">·</i>}
                            <StandingPoints standing={standing} showGamePoints={showGamePoints} />
                            <StandingMovement standing={standing} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="podium-base">
                    <strong>{group.rank}</strong>
                    <span>{placeLabel(group.rank)}</span>
                  </div>
                </article>
              ))}
            </div>

            {remainingStandings.length > 0 && (
              <div className="standings-list" aria-label="Remaining standings">
                {remainingStandings.map((standing, index) => {
                  const entryId = standingEntryId(standing)
                  const entry = entriesByLeagueEntryId.get(entryId) ?? entriesByEntryId.get(entryId)
                  return (
                    <div className="standings-list-row" key={`${entryId}-${index}`}>
                      <strong>{standing.rank || index + 1}</strong>
                      <span>{entry?.entry_name ?? `Entry ${entryId}`}</span>
                      <StandingMovement standing={standing} />
                      <StandingPoints standing={standing} showGamePoints={showGamePoints} />
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ))}

      {mode === 'teams' && (
        <section className="league-teams-view">
          <div className="league-manager-panel">
            {(hasManagerOverflow || teamSearch) && (
              <input
                className="manager-search"
                value={teamSearch}
                onChange={(event) => setTeamSearch(event.target.value)}
                placeholder="Search clubs"
              />
            )}
            <div className="manager-grid" ref={managerListRef}>
              {filteredEntries.map((entry) => (
                <button
                  type="button"
                  className={selectedEntryId === entry.entry_id ? 'selected-manager' : ''}
                  key={entry.entry_id}
                  onClick={() => setSelectedEntryId(entry.entry_id)}
                >
                  <strong>{entry.entry_name}</strong>
                  <span>{managerName(entry.player_first_name, entry.player_last_name)}</span>
                </button>
              ))}
            </div>
          </div>
          {selectedEntry ? (
            <LeagueTeamVisual
              discovery={discovery}
              entryId={selectedEntry.entry_id}
              entryName={selectedEntry.entry_name}
              manager={managerName(selectedEntry.player_first_name, selectedEntry.player_last_name)}
              shirtCodes={shirtCodes}
              leagueId={leagueId}
            />
          ) : (
            <div className="league-team-empty-card">
              <strong>Select a club</strong>
            </div>
          )}
        </section>
      )}

      {mode === 'matchups' && showGamePoints && (
        <section className="league-matchups-view">
          {matchweeks.length === 0 ? (
            <p className="empty-text compact-empty">No matchups returned by FPL yet.</p>
          ) : (
            <>
              {previousMatchweeks.length > 0 && (
                <details className="matchweek-archive">
                  <summary>
                    Previous matchweeks <span>{previousMatchweeks.length}</span>
                  </summary>
                  <div>{previousMatchweeks.map(renderMatchweek)}</div>
                </details>
              )}
              {currentMatchweek ? (
                renderMatchweek(currentMatchweek)
              ) : (
                <p className="empty-text compact-empty">
                  No matchups for gameweek {currentGameweek} yet.
                </p>
              )}
              {futureMatchweeks.length > 0 && (
                <details className="matchweek-archive">
                  <summary>
                    Future matchweeks <span>{futureMatchweeks.length}</span>
                  </summary>
                  <div>{futureMatchweeks.map(renderMatchweek)}</div>
                </details>
              )}
            </>
          )}
        </section>
      )}
    </section>
  )
}

function StandingPoints({
  standing,
  showGamePoints,
}: {
  standing: FplStanding
  showGamePoints: boolean
}) {
  return (
    <small className="standing-points">
      {showGamePoints && (
        <>
          <span>{standingGamePoints(standing)}</span>
          <i>·</i>
        </>
      )}
      <b>{standingPoints(standing)} pts</b>
    </small>
  )
}

function StandingMovement({ standing }: { standing: FplStanding }) {
  const lastRank = standingLastRank(standing)
  if (!lastRank || !standing.rank) return null
  const movement = lastRank > standing.rank ? 'up' : lastRank < standing.rank ? 'down' : 'same'
  const label = movement === 'up' ? 'Moved up' : movement === 'down' ? 'Moved down' : 'No movement'
  const Icon = movement === 'up' ? ArrowUp : movement === 'down' ? ArrowDown : Minus
  return (
    <em
      className={`standing-movement standing-movement-${movement}`}
      aria-label={label}
      title={label}
    >
      <Icon size={13} strokeWidth={3} />
    </em>
  )
}
