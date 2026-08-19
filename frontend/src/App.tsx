import { Activity, Database, FlaskConical, Radio, RotateCcw, Search, SkipForward } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { loadLeagueDiscovery, loadMockLeagueDiscovery } from './api/fplDiscoveryApi'
import { loadLiveState, postMockAction } from './api/liveApi'
import { BroadcastMatchday } from './components/broadcast/BroadcastMatchday'
import { LeagueDiscoverySummary } from './components/discovery/LeagueDiscoverySummary'
import type { LeagueDiscoveryState } from './types/fpl'
import type { AppView, BroadcastFocus, LiveStateResponse, RevealLayout } from './types/live'
import { findFocusedMatchup, toRevealRect, toScoreRevealRect } from './utils/broadcast'
import './App.css'

const SCENE_WIPE_MS = 1600
const SCENE_SWAP_MS = SCENE_WIPE_MS / 2
const MATCH_REVEAL_MS = 1900

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
  const [broadcastFocus, setBroadcastFocus] = useState<BroadcastFocus>('multi')
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
  const autoTargetMatchup = findFocusedMatchup(liveState)
  const selectedTargetMatchup =
    broadcastFocus === 'multi' ? undefined : liveState?.matchups.find((candidate) => candidate.id === broadcastFocus)
  const targetMatchup = selectedTargetMatchup ?? autoTargetMatchup
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

    if (broadcastFocus !== 'multi' && !firstBroadcastFocus) {
      setBroadcastLiveState(liveState)
      setTransitioningToMatch(false)
      setRevealingMatch(false)
      setRevealLayout(null)
      setVisibleEventId(targetLatestEvent?.id ?? null)
      return clearTransitionTimers
    }

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
  }, [appView, broadcastFocus, focusedMatchupId, liveState, targetLatestEvent?.id])

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
        setBroadcastFocus('multi')
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
          <h1>Draft Broadcast</h1>
          <p>{error ? error : 'Loading live broadcast state...'}</p>
        </div>
      </main>
    )
  }

  const displayLiveState = appView === 'broadcast' ? broadcastLiveState ?? liveState : liveState
  const autoDisplayMatchup = findFocusedMatchup(displayLiveState)
  const selectedDisplayMatchup =
    broadcastFocus === 'multi' ? undefined : displayLiveState.matchups.find((candidate) => candidate.id === broadcastFocus)
  const matchup = selectedDisplayMatchup ?? autoDisplayMatchup ?? targetMatchup
  const latestCommentary = displayLiveState.commentary[0]
  const leaderName =
    matchup.leaderManagerId === matchup.home.managerId
      ? matchup.home.displayName
      : matchup.leaderManagerId === matchup.away.managerId
        ? matchup.away.displayName
        : 'No one'

  if (appView === 'broadcast') {
    return (
      <BroadcastMatchday
        displayLiveState={displayLiveState}
        matchup={matchup}
        latestCommentaryText={latestCommentary?.text ?? 'Waiting for commentary.'}
        latestCommentaryStatus={latestCommentary?.status ?? 'WAITING'}
        leaderName={leaderName}
        broadcastFocus={broadcastFocus}
        revealingMatch={revealingMatch}
        revealLayout={revealLayout}
        transitioningToMatch={transitioningToMatch}
        visibleEventId={visibleEventId}
        homeHeadingRef={homeHeadingRef}
        awayHeadingRef={awayHeadingRef}
        scoreRef={scoreRef}
        onBack={() => setAppView('setup')}
        onSelectFocus={setBroadcastFocus}
      />
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

export default App
