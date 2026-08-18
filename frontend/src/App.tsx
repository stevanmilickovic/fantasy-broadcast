import { Activity, Radio, RotateCcw, SkipForward, Trophy } from 'lucide-react'
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

const loadLiveState = async (): Promise<LiveStateResponse> => {
  const response = await fetch('/api/live-state')
  if (!response.ok) {
    throw new Error(`Live state request failed with ${response.status}`)
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
