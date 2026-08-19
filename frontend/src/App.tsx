import { Activity, Database, FlaskConical, Radio, RotateCcw, Search, SkipForward, Trophy } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useEffect, useMemo, useState } from 'react'
import './App.css'

type SequenceState = {
  currentStep: number
  totalSteps: number
  started: boolean
  complete: boolean
}

type LiveStatus = {
  mode: string
  updatedAt: string
  message: string
}

type PlayerView = {
  id: string
  displayName: string
  premierLeagueClub: string
  position: string
  lineupSlot: string
  points: number
  status: string
  recentDelta: number
}

type TeamView = {
  managerId: string
  displayName: string
  clubName: string
  shortName: string
  color: string
  score: number
  activePlayers: PlayerView[]
  benchPlayers: PlayerView[]
}

type MatchupView = {
  id: string
  home: TeamView
  away: TeamView
  leaderManagerId: string
  scoreline: string
}

type FantasyEventView = {
  id: string
  occurredAt: string
  type: string
  managerId: string
  playerId: string
  summary: string
  pointDelta: number
  priority: number
}

type CommentaryView = {
  id: string
  createdAt: string
  text: string
  priority: number
  status: string
}

type LiveStateResponse = {
  status: LiveStatus
  sequence: SequenceState
  gameweek: number
  matchups: MatchupView[]
  events: FantasyEventView[]
  commentary: CommentaryView[]
}

type FplLeagueEntry = {
  id: number
  entry_id: number
  entry_name: string
  player_first_name: string
  player_last_name: string
  short_name: string
}

type FplLeagueMatch = {
  id: number
  event: number
  league_entry_1?: number
  league_entry_2?: number
  firstLeagueEntryId?: number
  secondLeagueEntryId?: number
  league_entry_1_points?: number
  league_entry_2_points?: number
  firstPoints?: number
  secondPoints?: number
  finished: boolean
}

type FplStanding = {
  league_entry?: number
  leagueEntryId?: number
  rank: number
  total?: number
  headToHeadPoints?: number
  points_for?: number
  pointsFor?: number
}

type FplLeagueDetailsRaw = {
  league?: {
    id: number
    name: string
    draft_status: string
    draft_dt: string
    max_entries: number
    min_entries: number
    scoring: string
    start_event: number
    stop_event: number
  }
  league_entries: FplLeagueEntry[]
  matches: FplLeagueMatch[]
  standings: FplStanding[]
}

type FplElementStatusRaw = {
  element_status: Array<{
    element: number
    owner: number | null
    status: string
    in_accepted_trade: boolean
  }>
}

type FplPlayer = {
  id: number
  webName: string
  fullName: string
  premierLeagueClub: string
  position: string
}

type FplEntryPick = {
  element: number
  position: number
  multiplier: number
  starter: boolean
  benched: boolean
}

type FplEntryEvent = {
  picks: FplEntryPick[]
}

type FplLivePlayer = {
  id: number
  stats: {
    minutes: number
    goalsScored: number
    assists: number
    cleanSheets: number
    goalsConceded: number
    ownGoals: number
    penaltiesSaved: number
    penaltiesMissed: number
    yellowCards: number
    redCards: number
    saves: number
    bonus: number
    bps: number
    totalPoints: number
  }
}

type FplDraftEventLive = {
  fixtures: Array<{
    id: number
    event: number
    homeTeamId: number
    awayTeamId: number
    homeScore: number | null
    awayScore: number | null
    started: boolean
    finished: boolean
    minutes: number
    kickoffTime: string
  }>
}

type LeagueDiscoveryState = {
  details: FplLeagueDetailsRaw
  elementStatus: FplElementStatusRaw
  players: FplPlayer[]
  entryEvents?: Record<string, FplEntryEvent>
  livePlayers?: FplLivePlayer[]
  draftEventLive?: FplDraftEventLive
}

type DiscoveryTab = 'teams' | 'compositions' | 'matchups' | 'standings'

const loadLiveState = async (): Promise<LiveStateResponse> => {
  const response = await fetch('/api/live-state')
  if (!response.ok) {
    throw new Error(`Live state request failed with ${response.status}`)
  }
  return response.json()
}

const loadLeagueDiscovery = async (leagueId: string): Promise<LeagueDiscoveryState> => {
  const [detailsResponse, elementStatusResponse, playersResponse] = await Promise.all([
    fetch(`/api/fpl/discovery/league/${leagueId}/raw`),
    fetch(`/api/fpl/discovery/league/${leagueId}/element-status/raw`),
    fetch('/api/fpl/discovery/players?limit=1000'),
  ])

  if (!detailsResponse.ok) {
    throw new Error(`League request failed with ${detailsResponse.status}`)
  }
  if (!elementStatusResponse.ok) {
    throw new Error(`Element status request failed with ${elementStatusResponse.status}`)
  }
  if (!playersResponse.ok) {
    throw new Error(`Players request failed with ${playersResponse.status}`)
  }

  return {
    details: (await detailsResponse.json()) as FplLeagueDetailsRaw,
    elementStatus: (await elementStatusResponse.json()) as FplElementStatusRaw,
    players: (await playersResponse.json()) as FplPlayer[],
  }
}

const loadMockLeagueDiscovery = async (): Promise<LeagueDiscoveryState> => {
  const response = await fetch('/api/fpl/mock/start')
  if (!response.ok) {
    throw new Error(`Mock league request failed with ${response.status}`)
  }
  return response.json()
}

const postMockAction = async (action: 'start' | 'advance' | 'reset'): Promise<LiveStateResponse> => {
  const response = await fetch(`/api/mock-live/${action}`, { method: 'POST' })
  if (!response.ok) {
    throw new Error(`Mock action failed with ${response.status}`)
  }
  return response.json()
}

function App() {
  const [liveState, setLiveState] = useState<LiveStateResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [isStreamConnected, setIsStreamConnected] = useState(false)
  const [leagueId, setLeagueId] = useState('49824')
  const [leagueDiscovery, setLeagueDiscovery] = useState<LeagueDiscoveryState | null>(null)
  const [leagueError, setLeagueError] = useState<string | null>(null)
  const [isLeagueLoading, setIsLeagueLoading] = useState(false)

  useEffect(() => {
    loadLiveState()
      .then((state) => {
        setLiveState(state)
        setError(null)
      })
      .catch((requestError: Error) => setError(requestError.message))
  }, [])

  useEffect(() => {
    const events = new EventSource('/api/live-state/stream')

    events.onopen = () => {
      setIsStreamConnected(true)
    }

    events.addEventListener('live-state', (event) => {
      setLiveState(JSON.parse(event.data) as LiveStateResponse)
      setError(null)
    })

    events.onerror = () => {
      setIsStreamConnected(false)
    }

    return () => {
      events.close()
    }
  }, [])

  const matchup = liveState?.matchups[0]
  const latestCommentary = liveState?.commentary[0]
  const allPlayers = useMemo(() => {
    if (!matchup) {
      return []
    }
    return [
      ...matchup.home.activePlayers.map((player) => ({ ...player, managerName: matchup.home.displayName })),
      ...matchup.away.activePlayers.map((player) => ({ ...player, managerName: matchup.away.displayName })),
    ]
  }, [matchup])

  const runAction = async (action: 'start' | 'advance' | 'reset') => {
    setIsBusy(true)
    try {
      const nextState = await postMockAction(action)
      setLiveState(nextState)
      setError(null)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unknown request error')
    } finally {
      setIsBusy(false)
    }
  }

  const inspectLeague = async () => {
    const normalizedLeagueId = leagueId.trim()
    if (!normalizedLeagueId) {
      setLeagueError('Enter a league id.')
      return
    }

    setIsLeagueLoading(true)
    try {
      const nextDiscovery = await loadLeagueDiscovery(normalizedLeagueId)
      setLeagueDiscovery(nextDiscovery)
      setLeagueError(null)
    } catch (requestError) {
      setLeagueError(requestError instanceof Error ? requestError.message : 'Unknown league request error')
    } finally {
      setIsLeagueLoading(false)
    }
  }

  const inspectMockLeague = async () => {
    setIsLeagueLoading(true)
    try {
      const nextDiscovery = await loadMockLeagueDiscovery()
      setLeagueDiscovery(nextDiscovery)
      setLeagueError(null)
      setLeagueId(String(nextDiscovery.details.league?.id ?? leagueId))
    } catch (requestError) {
      setLeagueError(requestError instanceof Error ? requestError.message : 'Unknown mock league request error')
    } finally {
      setIsLeagueLoading(false)
    }
  }

  if (!liveState || !matchup) {
    return (
      <main className="broadcast-shell loading-shell">
        <div>
          <Radio size={28} />
          <h1>Seks Telecom League</h1>
          <p>{error ? error : 'Loading live broadcast state...'}</p>
        </div>
      </main>
    )
  }

  const leaderName =
    matchup.leaderManagerId === matchup.home.managerId ? matchup.home.displayName : matchup.away.displayName

  return (
    <main className="broadcast-shell">
      <header className="broadcast-header">
        <div>
          <span className="kicker">
            <Radio size={16} />
            Gameweek {liveState.gameweek}
          </span>
          <h1>Seks Telecom League</h1>
        </div>
        <div className="status-panel">
          <span>{liveState.status.mode}</span>
          <strong>
            Step {liveState.sequence.currentStep}/{liveState.sequence.totalSteps}
          </strong>
          <small className={isStreamConnected ? 'stream-on' : 'stream-off'}>
            {isStreamConnected ? 'Stream connected' : 'Stream reconnecting'}
          </small>
        </div>
      </header>

      <section className="league-discovery" aria-label="FPL Draft league discovery">
        <div className="discovery-form">
          <div>
            <span className="kicker">
              <Database size={16} />
              FPL Discovery
            </span>
            <h2>League Data Check</h2>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void inspectLeague()
            }}
          >
            <label htmlFor="league-id">League ID</label>
            <input
              id="league-id"
              inputMode="numeric"
              value={leagueId}
              onChange={(event) => setLeagueId(event.target.value)}
              placeholder="49824"
            />
            <button type="submit" disabled={isLeagueLoading}>
              <Search size={18} />
              Load
            </button>
            <button type="button" className="secondary-action" disabled={isLeagueLoading} onClick={inspectMockLeague}>
              <FlaskConical size={18} />
              Test
            </button>
          </form>
        </div>
        {leagueError && <p className="discovery-error">{leagueError}</p>}
        {leagueDiscovery ? <LeagueDiscoverySummary discovery={leagueDiscovery} /> : null}
      </section>

      <section className="controls-row" aria-label="Mock broadcast controls">
        <button type="button" onClick={() => runAction('start')} disabled={isBusy}>
          <Activity size={18} />
          Start
        </button>
        <button type="button" onClick={() => runAction('advance')} disabled={isBusy || liveState.sequence.complete}>
          <SkipForward size={18} />
          Advance
        </button>
        <button type="button" onClick={() => runAction('reset')} disabled={isBusy}>
          <RotateCcw size={18} />
          Reset
        </button>
        <p>{error ? error : liveState.status.message}</p>
      </section>

      <section className="scoreboard" aria-label="Current matchup">
        <TeamScore team={matchup.home} isLeader={matchup.leaderManagerId === matchup.home.managerId} />
        <div className="versus">
          <span>VS</span>
          <strong>{matchup.scoreline}</strong>
          <small>
            <Trophy size={14} />
            {leaderName} leads
          </small>
        </div>
        <TeamScore team={matchup.away} isLeader={matchup.leaderManagerId === matchup.away.managerId} />
      </section>

      <section className="content-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>Live Players</h2>
            <span>{allPlayers.length} active</span>
          </div>
          <div className="player-list">
            {allPlayers.map((player) => (
              <div className="player-row" key={`${player.managerName}-${player.id}`}>
                <div>
                  <strong>{player.displayName}</strong>
                  <span>
                    {player.managerName} · {player.premierLeagueClub} · {player.position}
                  </span>
                </div>
                <div className="points-cell">
                  {player.recentDelta > 0 && <span className="delta">+{player.recentDelta}</span>}
                  <strong>{player.points}</strong>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h2>Recent Events</h2>
            <span>{liveState.events.length}</span>
          </div>
          <div className="event-list">
            {liveState.events.length === 0 ? (
              <p className="empty-text">No fantasy events yet.</p>
            ) : (
              liveState.events.map((event) => (
                <article className="event-row" key={event.id}>
                  <span>{event.type.replaceAll('_', ' ')}</span>
                  <p>{event.summary}</p>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="panel commentary-panel">
          <div className="panel-heading">
            <h2>Now On Air</h2>
            <span>{latestCommentary?.status ?? 'WAITING'}</span>
          </div>
          <blockquote>{latestCommentary?.text ?? 'Waiting for commentary.'}</blockquote>
        </section>
      </section>
    </main>
  )
}

function LeagueDiscoverySummary({ discovery }: { discovery: LeagueDiscoveryState }) {
  const [activeTab, setActiveTab] = useState<DiscoveryTab>('teams')
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null)
  const { details, elementStatus } = discovery
  const entries = details.league_entries ?? []
  const matches = details.matches ?? []
  const standings = details.standings ?? []
  const playerStatuses = elementStatus.element_status ?? []
  const ownedPlayers = playerStatuses.filter((status) => status.owner !== null)
  const freeAgents = playerStatuses.length - ownedPlayers.length
  const entryNamesById = new Map(entries.map((entry) => [entry.id, entry.entry_name]))
  const entryNamesByEntryId = new Map(entries.map((entry) => [entry.entry_id, entry.entry_name]))
  const playersById = new Map(discovery.players.map((player) => [player.id, player]))
  const livePlayersById = new Map((discovery.livePlayers ?? []).map((player) => [player.id, player]))
  const activeFixtureCount = discovery.draftEventLive?.fixtures.filter((fixture) => fixture.started && !fixture.finished).length ?? 0
  const hasCompositions = ownedPlayers.length > 0
  const hasMatchups = matches.length > 0
  const hasStandings = standings.length > 0
  const selectedEntry = entries.find((entry) => entry.entry_id === selectedEntryId) ?? null
  const selectedEntryPicks = selectedEntry ? discovery.entryEvents?.[String(selectedEntry.entry_id)]?.picks ?? [] : []
  const selectedPicksByElement = new Map(selectedEntryPicks.map((pick) => [pick.element, pick]))
  const selectedPlayers = selectedEntry
    ? ownedPlayers
        .filter((status) => status.owner === selectedEntry.entry_id)
        .map((status) => ({
          status,
          player: playersById.get(status.element),
          pick: selectedPicksByElement.get(status.element),
          livePlayer: livePlayersById.get(status.element),
        }))
        .sort((first, second) => {
          if (first.pick && second.pick) {
            return first.pick.position - second.pick.position
          }
          const firstName = first.player?.webName ?? String(first.status.element)
          const secondName = second.player?.webName ?? String(second.status.element)
          return firstName.localeCompare(secondName)
        })
    : []

  return (
    <div className="discovery-results">
      <div className="discovery-title">
        <div>
          <h3>{details.league?.name ?? 'Draft League'}</h3>
          <p>
            Draft {details.league?.draft_status ?? 'unknown'} · {entries.length} teams · scoring{' '}
            {details.league?.scoring ?? 'unknown'}
          </p>
        </div>
        <span>{details.league?.id ?? 'Unknown ID'}</span>
      </div>

      <div className="readiness-grid">
        <ReadinessItem
          label="Team compositions"
          value={hasCompositions ? `${ownedPlayers.length} owned players` : 'Not available yet'}
          ready={hasCompositions}
        />
        <ReadinessItem
          label="Matchups"
          value={hasMatchups ? `${matches.length} scheduled` : 'Not prepared yet'}
          ready={hasMatchups}
        />
        <ReadinessItem
          label="Standings"
          value={hasStandings ? `${standings.length} rows` : 'Not available yet'}
          ready={hasStandings}
        />
        <ReadinessItem
          label="Free agents"
          value={playerStatuses.length > 0 ? `${freeAgents} players` : 'Unknown'}
          ready={playerStatuses.length > 0}
        />
        <ReadinessItem
          label="Live fixtures"
          value={activeFixtureCount > 0 ? `${activeFixtureCount} just started` : 'None active'}
          ready={activeFixtureCount > 0}
        />
      </div>

      <div className="discovery-tabs" role="tablist" aria-label="League discovery sections">
        <DiscoveryTabButton activeTab={activeTab} tab="teams" label="Teams" onSelect={setActiveTab} />
        <DiscoveryTabButton
          activeTab={activeTab}
          tab="compositions"
          label="Compositions"
          onSelect={setActiveTab}
        />
        <DiscoveryTabButton activeTab={activeTab} tab="matchups" label="Matchups" onSelect={setActiveTab} />
        <DiscoveryTabButton activeTab={activeTab} tab="standings" label="Standings" onSelect={setActiveTab} />
      </div>

      <div className="discovery-panel">
        {activeTab === 'teams' && (
          <section>
            <h4>Teams Present</h4>
            <div className="compact-list">
              {entries.map((entry) => (
                <button
                  className="compact-row compact-button"
                  type="button"
                  key={entry.id}
                  onClick={() => {
                    setSelectedEntryId(entry.entry_id)
                    setActiveTab('compositions')
                  }}
                >
                  <strong>{entry.entry_name}</strong>
                  <span>
                    {entry.player_first_name} {entry.player_last_name} · entry {entry.entry_id} · league entry{' '}
                    {entry.id}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'compositions' && (
          <section>
            <h4>Team Compositions</h4>
            {!hasCompositions ? (
              <p className="empty-text compact-empty">No owned players returned by FPL yet.</p>
            ) : (
              <div className="composition-layout">
                <div className="team-picker">
                  {entries.map((entry) => {
                    const squadSize = ownedPlayers.filter((status) => status.owner === entry.entry_id).length
                    return (
                      <button
                        type="button"
                        key={entry.entry_id}
                        className={selectedEntryId === entry.entry_id ? 'selected-team' : ''}
                        onClick={() => setSelectedEntryId(entry.entry_id)}
                      >
                        <strong>{entry.entry_name}</strong>
                        <span>{squadSize} players</span>
                      </button>
                    )
                  })}
                </div>
                <div className="player-composition">
                  {selectedEntry ? (
                    <>
                      <div className="composition-heading">
                        <strong>{selectedEntry.entry_name}</strong>
                        <span>{selectedPlayers.length} owned players</span>
                      </div>
                      <div className="compact-list">
                        {selectedPlayers.map(({ status, player, pick, livePlayer }) => (
                          <div className="compact-row player-composition-row" key={status.element}>
                            <strong>{player?.webName ?? `Player ${status.element}`}</strong>
                            <span>
                              {player?.fullName ?? 'Unknown player'} · {player?.premierLeagueClub ?? 'Unknown club'} ·{' '}
                              {player?.position ?? 'Unknown position'} · {pick ? (pick.starter ? 'starter' : 'bench') : 'no pick'}{' '}
                              {pick ? `#${pick.position}` : ''} · {livePlayer?.stats.minutes ?? 0} min ·{' '}
                              {livePlayer?.stats.totalPoints ?? 0} pts
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="empty-text compact-empty">Select a team to inspect its players.</p>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === 'matchups' && (
          <section>
            <h4>Matchups</h4>
            <div className="compact-list">
              {matches.length === 0 ? (
                <p className="empty-text compact-empty">No matchups returned by FPL yet.</p>
              ) : (
                matches.map((match, index) => {
                  const firstEntryId = match.league_entry_1 ?? match.firstLeagueEntryId ?? 0
                  const secondEntryId = match.league_entry_2 ?? match.secondLeagueEntryId ?? 0
                  const firstPoints = match.league_entry_1_points ?? match.firstPoints ?? 0
                  const secondPoints = match.league_entry_2_points ?? match.secondPoints ?? 0
                  return (
                    <div className="compact-row" key={`${match.event}-${firstEntryId}-${secondEntryId}-${index}`}>
                      <strong>
                        GW{match.event}: {entryNamesById.get(firstEntryId) ?? firstEntryId} vs{' '}
                        {entryNamesById.get(secondEntryId) ?? secondEntryId}
                      </strong>
                      <span>
                        {firstPoints}-{secondPoints} · {match.finished ? 'finished' : 'not finished'}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </section>
        )}

        {activeTab === 'standings' && (
          <section>
            <h4>Standings</h4>
            <div className="standings-table">
              {standings.length === 0 ? (
                <p className="empty-text compact-empty">No standings returned by FPL yet.</p>
              ) : (
                standings
                  .slice()
                  .sort((first, second) => first.rank - second.rank)
                  .map((standing, index) => {
                    const entryId = standing.league_entry ?? standing.leagueEntryId ?? 0
                    const points = standing.total ?? standing.headToHeadPoints ?? 0
                    const pointsFor = standing.points_for ?? standing.pointsFor ?? 0
                    return (
                      <div className="standings-row" key={`${entryId}-${index}`}>
                        <strong>{standing.rank || index + 1}</strong>
                        <span>{entryNamesById.get(entryId) ?? entryNamesByEntryId.get(entryId) ?? entryId}</span>
                        <small>{points} pts</small>
                        <small>{pointsFor} PF</small>
                      </div>
                    )
                  })
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function DiscoveryTabButton({
  activeTab,
  tab,
  label,
  onSelect,
}: {
  activeTab: DiscoveryTab
  tab: DiscoveryTab
  label: string
  onSelect: (tab: DiscoveryTab) => void
}) {
  return (
    <button type="button" className={activeTab === tab ? 'active-tab' : ''} onClick={() => onSelect(tab)}>
      {label}
    </button>
  )
}

function ReadinessItem({ label, value, ready }: { label: string; value: string; ready: boolean }) {
  return (
    <div className="readiness-item">
      <span className={ready ? 'ready-dot' : 'waiting-dot'} />
      <div>
        <strong>{label}</strong>
        <small>{value}</small>
      </div>
    </div>
  )
}

function TeamScore({ team, isLeader }: { team: TeamView; isLeader: boolean }) {
  const teamStyle: CSSProperties & Record<'--team-color', string> = {
    '--team-color': team.color,
  }

  return (
    <article className="team-score" style={teamStyle}>
      <div>
        <span>{team.shortName}</span>
        <h2>{team.clubName}</h2>
        <p>{team.displayName}</p>
      </div>
      <strong>{team.score}</strong>
      {isLeader && <small>Leading</small>}
    </article>
  )
}

export default App
