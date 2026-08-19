import { Activity, ArrowLeft, Database, FlaskConical, Radio, RotateCcw, Search, SkipForward, Trophy } from 'lucide-react'
import type { CSSProperties, RefObject } from 'react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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
  shortName?: string
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
type AppView = 'setup' | 'broadcast'
type RevealRect = {
  left: number
  top: number
  width: number
  height: number
  revealX: number
  revealY: number
}
type RevealLayout = {
  home: RevealRect
  away: RevealRect
  score: RevealRect
}
type PlayerGroup = {
  key: string
  label: string
  players: PlayerView[]
}

const SCENE_WIPE_MS = 1600
const SCENE_SWAP_MS = SCENE_WIPE_MS / 2
const MATCH_REVEAL_MS = 1900

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

const findFocusedMatchup = (state: LiveStateResponse | null): MatchupView | undefined => {
  if (!state) {
    return undefined
  }

  const latestEvent = state.events[0]
  return latestEvent
    ? state.matchups.find((candidate) =>
        [candidate.home.managerId, candidate.away.managerId].includes(latestEvent.managerId),
      ) ?? state.matchups[0]
    : state.matchups[0]
}

const formatScoreline = (scoreline: string): string => {
  const scoreMatch = scoreline.match(/^(-?\d+)-(-?\d+)$/)
  if (!scoreMatch) {
    return scoreline
  }

  const firstScore = Number(scoreMatch[1])
  const secondScore = Number(scoreMatch[2])
  return firstScore < 0 || secondScore < 0 ? `${firstScore} to ${secondScore}` : `${firstScore}-${secondScore}`
}

const toRevealRect = (rect: DOMRect, startCenterX: number): RevealRect => ({
  left: rect.left,
  top: rect.top,
  width: rect.width,
  height: rect.height,
  revealX: startCenterX - (rect.left + rect.width / 2),
  revealY: window.innerHeight / 2 - (rect.top + rect.height / 2),
})

const toScoreRevealRect = (rect: DOMRect): RevealRect => ({
  left: rect.left,
  top: rect.top,
  width: rect.width,
  height: rect.height,
  revealX: window.innerWidth / 2 - (rect.left + rect.width / 2),
  revealY: window.innerHeight / 2 - (rect.top + rect.height / 2),
})

const revealCopyStyle = (rect: RevealRect, scale: number): CSSProperties & Record<string, string | number> => ({
  left: rect.left,
  top: rect.top,
  width: rect.width,
  height: rect.height,
  '--reveal-x': `${rect.revealX}px`,
  '--reveal-y': `${rect.revealY}px`,
  '--reveal-scale': scale,
})

const playerGroupsForTeam = (team: TeamView): PlayerGroup[] => {
  const activePlayers = team.activePlayers
  return [
    { key: 'FWD', label: 'FWD', players: activePlayers.filter((player) => player.position === 'FWD') },
    { key: 'MID', label: 'MID', players: activePlayers.filter((player) => player.position === 'MID') },
    { key: 'DEF', label: 'DEF', players: activePlayers.filter((player) => player.position === 'DEF') },
    { key: 'GKP', label: 'GKP', players: activePlayers.filter((player) => player.position === 'GKP') },
    { key: 'BENCH', label: 'Bench', players: team.benchPlayers },
  ].filter((group) => group.players.length > 0)
}

const splitPlayerName = (displayName: string): [string, string] => {
  const nameParts = displayName.trim().split(/\\s+/)
  if (nameParts.length <= 1) {
    return [displayName, '']
  }
  return [nameParts.slice(0, -1).join(' '), nameParts.at(-1) ?? '']
}

const playerCardName = (player: PlayerView): [string, string] => {
  return player.shortName ? [player.shortName, ''] : splitPlayerName(player.displayName)
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
  const [appView, setAppView] = useState<AppView>('setup')
  const [broadcastLiveState, setBroadcastLiveState] = useState<LiveStateResponse | null>(null)
  const [transitioningToMatch, setTransitioningToMatch] = useState(false)
  const [revealingMatch, setRevealingMatch] = useState(false)
  const [revealLayout, setRevealLayout] = useState<RevealLayout | null>(null)
  const [visibleEventId, setVisibleEventId] = useState<string | null>(null)
  const lastFocusedMatchupIdRef = useRef<string | null>(null)
  const transitionTimersRef = useRef<number[]>([])
  const homeHeadingRef = useRef<HTMLHeadingElement>(null)
  const awayHeadingRef = useRef<HTMLHeadingElement>(null)
  const scoreRef = useRef<HTMLElement>(null)

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

  const clearTransitionTimers = () => {
    transitionTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    transitionTimersRef.current = []
  }

  const targetLatestEvent = liveState?.events[0]
  const targetMatchup = findFocusedMatchup(liveState)
  const focusedMatchupId = targetMatchup?.id ?? null

  useEffect(() => {
    clearTransitionTimers()

    if (!liveState || !focusedMatchupId || appView !== 'broadcast') {
      lastFocusedMatchupIdRef.current = null
      setBroadcastLiveState(liveState)
      setTransitioningToMatch(false)
      setRevealingMatch(false)
      setRevealLayout(null)
      setVisibleEventId(targetLatestEvent?.id ?? null)
      return
    }

    const previousFocusedMatchupId = lastFocusedMatchupIdRef.current
    const firstBroadcastFocus = previousFocusedMatchupId === null
    const focusChanged = previousFocusedMatchupId !== null && previousFocusedMatchupId !== focusedMatchupId
    lastFocusedMatchupIdRef.current = focusedMatchupId

    if (firstBroadcastFocus) {
      setBroadcastLiveState(liveState)
      setVisibleEventId(null)
      setTransitioningToMatch(false)
      setRevealLayout(null)
      setRevealingMatch(true)
      const revealTimer = window.setTimeout(() => {
        setRevealingMatch(false)
        setVisibleEventId(targetLatestEvent?.id ?? null)
      }, MATCH_REVEAL_MS)
      transitionTimersRef.current = [revealTimer]
      return clearTransitionTimers
    }

    if (focusChanged) {
      setVisibleEventId(null)
      setTransitioningToMatch(true)
      setRevealingMatch(false)
      const swapTimer = window.setTimeout(() => {
        setBroadcastLiveState(liveState)
        setRevealLayout(null)
        setRevealingMatch(true)
      }, SCENE_SWAP_MS)
      const endTimer = window.setTimeout(() => {
        setTransitioningToMatch(false)
      }, SCENE_WIPE_MS)
      const revealTimer = window.setTimeout(() => {
        setRevealingMatch(false)
        setVisibleEventId(targetLatestEvent?.id ?? null)
      }, SCENE_SWAP_MS + MATCH_REVEAL_MS)
      transitionTimersRef.current = [swapTimer, endTimer, revealTimer]
      return clearTransitionTimers
    }

    setBroadcastLiveState(liveState)
    setTransitioningToMatch(false)
    setRevealingMatch(false)
    setVisibleEventId(targetLatestEvent?.id ?? null)

    return clearTransitionTimers
  }, [appView, focusedMatchupId, targetLatestEvent?.id])

  useLayoutEffect(() => {
    if (appView !== 'broadcast' || !homeHeadingRef.current || !awayHeadingRef.current || !scoreRef.current) {
      return
    }

    setRevealLayout({
      home: toRevealRect(homeHeadingRef.current.getBoundingClientRect(), window.innerWidth * 0.27),
      score: toScoreRevealRect(scoreRef.current.getBoundingClientRect()),
      away: toRevealRect(awayHeadingRef.current.getBoundingClientRect(), window.innerWidth * 0.73),
    })
  }, [appView, focusedMatchupId, broadcastLiveState])

  const runAction = async (action: 'start' | 'advance' | 'reset') => {
    setIsBusy(true)
    try {
      const nextState = await postMockAction(action)
      setLiveState(nextState)
      if (action === 'start') {
        setAppView('broadcast')
      }
      if (action === 'reset') {
        setAppView('setup')
      }
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

  if (!liveState || !targetMatchup) {
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

  const displayLiveState = appView === 'broadcast' ? broadcastLiveState ?? liveState : liveState
  const displayLatestEvent = displayLiveState.events[0]
  const matchup = findFocusedMatchup(displayLiveState) ?? targetMatchup
  const latestCommentary = displayLiveState.commentary[0]
  const leaderName =
    matchup.leaderManagerId === matchup.home.managerId
      ? matchup.home.displayName
      : matchup.leaderManagerId === matchup.away.managerId
        ? matchup.away.displayName
        : 'No one'

  if (appView === 'broadcast') {
    const displayEvent = visibleEventId === displayLatestEvent?.id ? displayLatestEvent : undefined
    const pendingEvent = displayEvent ? undefined : displayLatestEvent

    return (
      <main className={`broadcast-shell matchday-page ${revealingMatch ? 'revealing-match' : ''}`}>
        {transitioningToMatch && <div className="scene-wipe-overlay" aria-hidden="true" />}
        {revealingMatch && <MatchReveal layout={revealLayout} matchup={matchup} />}
        <button className="floating-back" type="button" onClick={() => setAppView('setup')}>
          <ArrowLeft size={18} />
          Back
        </button>
        <div className="live-indicator">
          <Radio size={16} />
          <span>Live</span>
        </div>

        <section className="matchday-stage" aria-label="Focused matchup broadcast">
          <BroadcastTeamColumn
            side="left"
            team={matchup.home}
            latestEvent={displayEvent}
            pendingEvent={pendingEvent}
            isLeader={matchup.leaderManagerId === matchup.home.managerId}
            headingRef={homeHeadingRef}
          />
          <MatchPitch
            gameweek={displayLiveState.gameweek}
            scoreline={matchup.scoreline}
            leaderName={leaderName}
            latestEvent={displayEvent}
            scoreRef={scoreRef}
          />
          <BroadcastTeamColumn
            side="right"
            team={matchup.away}
            latestEvent={displayEvent}
            pendingEvent={pendingEvent}
            isLeader={matchup.leaderManagerId === matchup.away.managerId}
            headingRef={awayHeadingRef}
          />
        </section>

        <section className="panel commentary-panel">
          <div className="panel-heading">
            <h2>Now On Air</h2>
            <span>{latestCommentary?.status ?? 'WAITING'}</span>
          </div>
          <blockquote>{latestCommentary?.text ?? 'Waiting for commentary.'}</blockquote>
        </section>
      </main>
    )
  }

  return (
    <main className="broadcast-shell">
      <header className="broadcast-header">
        <div>
          <span className="kicker">
            <Radio size={16} />
            Gameweek {liveState.gameweek}
          </span>
          <h1>Draft Broadcast</h1>
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
        {liveState.sequence.started && !liveState.sequence.complete && (
          <button type="button" onClick={() => setAppView('broadcast')} disabled={isBusy}>
            <Radio size={18} />
            Live
          </button>
        )}
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

function BroadcastTeamColumn({
  side,
  team,
  latestEvent,
  pendingEvent,
  isLeader,
  headingRef,
}: {
  side: 'left' | 'right'
  team: TeamView
  latestEvent?: FantasyEventView
  pendingEvent?: FantasyEventView
  isLeader: boolean
  headingRef: RefObject<HTMLHeadingElement | null>
}) {
  const teamStyle: CSSProperties & Record<'--team-color', string> = {
    '--team-color': team.color,
  }
  const playerGroups = playerGroupsForTeam(team)

  return (
    <section className={`broadcast-team-column ${side}`} style={teamStyle}>
      <div className="broadcast-team-heading">
        <span>{team.shortName}</span>
        <h2 ref={headingRef}>{team.clubName}</h2>
        <p>{team.displayName}</p>
        <strong className={isLeader ? '' : 'leader-placeholder'}>Leading</strong>
      </div>
      <div className="broadcast-player-board">
        {playerGroups.map((group) => (
          <div className={`broadcast-position-row ${group.key === 'BENCH' ? 'bench-row' : ''}`} key={group.key}>
            <span className="position-row-label">{group.label}</span>
            <div className="position-player-row">
              {group.players.map((player) => {
                const isChangedPlayer = latestEvent?.managerId === team.managerId && latestEvent.playerId === player.id
                const isPendingPlayer =
                  pendingEvent?.managerId === team.managerId && pendingEvent.playerId === player.id
                const pointEvent = latestEvent ?? pendingEvent
                const [firstName, surname] = playerCardName(player)
                const previousPoints =
                  (isChangedPlayer || isPendingPlayer) && pointEvent ? player.points - pointEvent.pointDelta : player.points
                const renderedPoints = isPendingPlayer ? previousPoints : player.points
                return (
                  <div
                    className={`broadcast-player-card ${isChangedPlayer ? 'broadcast-player-event' : ''}`}
                    key={player.id}
                  >
                    <div className="broadcast-player-name">
                      <strong>{firstName}</strong>
                      {surname && <strong>{surname}</strong>}
                    </div>
                    <PlayerPoints
                      key={isChangedPlayer ? `${latestEvent.id}-${player.id}-${player.points}` : `${player.id}-${renderedPoints}`}
                      points={renderedPoints}
                      previousPoints={previousPoints}
                      delta={isChangedPlayer ? latestEvent.pointDelta : 0}
                      eventId={isChangedPlayer ? latestEvent.id : undefined}
                    />
                    {isChangedPlayer && (
                      <div className="broadcast-player-notification">
                        <strong>{latestEvent.type.replaceAll('_', ' ')}</strong>
                        <span>
                          {latestEvent.pointDelta > 0 ? '+' : ''}
                          {latestEvent.pointDelta} pts
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function PlayerPoints({
  points,
  previousPoints,
  delta,
  eventId,
}: {
  points: number
  previousPoints: number
  delta: number
  eventId?: string
}) {
  const initialDisplayPoints = eventId && delta !== 0 ? previousPoints : points
  const [displayPoints, setDisplayPoints] = useState(initialDisplayPoints)

  useEffect(() => {
    if (!eventId || delta === 0) {
      setDisplayPoints(points)
      return
    }

    setDisplayPoints(previousPoints)
    const direction = delta > 0 ? 1 : -1
    const steps = Math.abs(delta)
    let currentStep = 0
    const interval = window.setInterval(() => {
      currentStep += 1
      setDisplayPoints(previousPoints + currentStep * direction)
      if (currentStep >= steps) {
        window.clearInterval(interval)
      }
    }, 120)

    return () => window.clearInterval(interval)
  }, [delta, eventId, points, previousPoints])

  return (
    <div className="broadcast-player-points">
      {eventId && delta !== 0 && (
        <span className="point-delta">
          {delta > 0 ? '+' : ''}
          {delta}
        </span>
      )}
      <span className="point-count">{displayPoints}</span>
    </div>
  )
}

function MatchPitch({
  gameweek,
  scoreline,
  leaderName,
  latestEvent,
  scoreRef,
}: {
  gameweek: number
  scoreline: string
  leaderName: string
  latestEvent?: FantasyEventView
  scoreRef: RefObject<HTMLElement | null>
}) {
  const eventText = latestEvent
    ? `${latestEvent.type.replaceAll('_', ' ')} ${latestEvent.pointDelta > 0 ? '+' : ''}${latestEvent.pointDelta}`
    : 'KICKOFF'

  return (
    <section className="pitch-panel" aria-label="Fantasy pitch">
      <div className="match-score-strip">
        <span>GW{gameweek}</span>
        <strong ref={scoreRef}>{formatScoreline(scoreline)}</strong>
        <small>
          <Trophy size={14} />
          {leaderName === 'No one' ? 'Level' : leaderName}
        </small>
      </div>
      <div className="css-pitch">
        <span className="pitch-line halfway" />
        <span className="pitch-box left-box" />
        <span className="pitch-box right-box" />
        <span className="pitch-circle" />
        <span className="moving-dot dot-one" />
        <span className="moving-dot dot-two" />
        <span className="moving-dot dot-three" />
        <span className="moving-dot dot-four" />
        <span className="moving-dot dot-five" />
        <span className="moving-dot dot-six" />
        <span className="moving-dot dot-ball" />
      </div>
      <div className="pitch-event-ticker">{eventText}</div>
    </section>
  )
}

function MatchReveal({ layout, matchup }: { layout: RevealLayout | null; matchup: MatchupView }) {
  return (
    <div className="match-reveal-overlay" aria-hidden="true">
      <div className="match-reveal-sheet" />
      {layout && (
        <>
          <strong className="match-reveal-copy match-reveal-team reveal-home" style={revealCopyStyle(layout.home, 1.08)}>
            {matchup.home.clubName}
          </strong>
          <strong className="match-reveal-copy match-reveal-score" style={revealCopyStyle(layout.score, 1.08)}>
            {formatScoreline(matchup.scoreline)}
          </strong>
          <strong className="match-reveal-copy match-reveal-team reveal-away" style={revealCopyStyle(layout.away, 1.08)}>
            {matchup.away.clubName}
          </strong>
        </>
      )}
    </div>
  )
}

export default App
