import { Activity, Database, FlaskConical, Radio, RotateCcw, Search, SkipForward } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { loadLeagueDiscovery, loadMockLeagueDiscovery } from './api/fplDiscoveryApi'
import { loadLiveState, postMockAction, startComprehensiveMock, startRealBroadcast, startTotalPointsMock, type FplLeagueScoring, type FplLeagueType } from './api/liveApi'
import { clearToken, loadCurrentUser, loadRegisteredLeagues, logout, storeToken, storedToken } from './api/customerApi'
import { BroadcastMatchday } from './components/broadcast/BroadcastMatchday'
import { AdminLeagueRegistry } from './components/customer/AdminLeagueRegistry'
import { BroadcastScheduleManager } from './components/customer/BroadcastScheduleManager'
import { AuthScreen } from './components/customer/AuthScreen'
import { CustomerDashboard } from './components/customer/CustomerDashboard'
import { LeagueDiscoverySummary } from './components/discovery/LeagueDiscoverySummary'
import type { AuthResponse, AuthUser } from './types/customer'
import type { LeagueDiscoveryState } from './types/fpl'
import type { AppView, BroadcastFocus, LiveStateResponse, RevealLayout } from './types/live'
import type { LiveStandingView } from './types/live'
import { findFocusedMatchup, toRevealRect, toScoreRevealRect } from './utils/broadcast'
import { enablePointChangeSound, playPointChangeSound } from './utils/broadcastSound'
import './App.css'

const SCENE_WIPE_MS = 1600
const SCENE_SWAP_MS = SCENE_WIPE_MS / 2
const MATCH_REVEAL_MS = 1900
const TOTAL_SCORE_REVEAL_Y_CORRECTION = 1

function App() {
  const [location, setLocation] = useState(() => ({ pathname: window.location.pathname, search: window.location.search }))
  const streamedLeagueId = Number(new URLSearchParams(location.search).get('leagueId')) || undefined
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [authToken, setAuthToken] = useState<string | null>(storedToken())
  const [isAuthLoading, setIsAuthLoading] = useState(Boolean(storedToken()))
  const [liveState, setLiveState] = useState<LiveStateResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [leagueId, setLeagueId] = useState('49824')
  const [leagueType, setLeagueType] = useState<FplLeagueType>('DRAFT')
  const [scoringType, setScoringType] = useState<FplLeagueScoring>('H2H')
  const [leagueDiscovery, setLeagueDiscovery] = useState<LeagueDiscoveryState | null>(null)
  const [leagueError, setLeagueError] = useState<string | null>(null)
  const [isLeagueLoading, setIsLeagueLoading] = useState(false)
  const [appView, setAppView] = useState<AppView>('setup')
  const [broadcastFocus, setBroadcastFocus] = useState<BroadcastFocus>('multi')
  const [broadcastLiveState, setBroadcastLiveState] = useState<LiveStateResponse | null>(null)
  const [broadcastStandings, setBroadcastStandings] = useState<LiveStandingView[] | null>(null)
  const [transitioningToMatch, setTransitioningToMatch] = useState(false)
  const [revealingMatch, setRevealingMatch] = useState(false)
  const [revealLayout, setRevealLayout] = useState<RevealLayout | null>(null)
  const [visibleEventId, setVisibleEventId] = useState<string | null>(null)
  const [holdingPendingUpdates, setHoldingPendingUpdates] = useState(false)
  const [lastAutoMatchupId, setLastAutoMatchupId] = useState<string | null>(null)
  const lastFocusedMatchupIdRef = useRef<string | null>(null)
  const lastSoundedEventIdRef = useRef<string | null>(null)
  const lastBroadcastFocusRef = useRef<BroadcastFocus>('multi')
  const transitionTimersRef = useRef<number[]>([])
  const homeHeadingRef = useRef<HTMLHeadingElement>(null)
  const awayHeadingRef = useRef<HTMLHeadingElement>(null)
  const scoreRef = useRef<HTMLElement>(null)
  const totalTeamNameRef = useRef<HTMLSpanElement>(null)
  const totalHeadingRef = useRef<HTMLHeadingElement>(null)
  const isLeagueBroadcast = location.pathname === '/broadcast' && streamedLeagueId !== undefined
  const shouldLoadLiveState = authUser?.role === 'ADMIN' || isLeagueBroadcast

  useEffect(() => {
    if (!shouldLoadLiveState) return
    const controller = new AbortController()
    let cancelled = false
    // Never show state from a previous/global broadcast while a league broadcast is loading.
    setLiveState(null)
    loadLiveState(isLeagueBroadcast ? streamedLeagueId : undefined, controller.signal)
      .then((state) => {
        if (cancelled) return
        setLiveState(state)
        setError(null)
      })
      .catch((requestError: Error) => {
        if (!cancelled && requestError.name !== 'AbortError') setError(requestError.message)
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [isLeagueBroadcast, shouldLoadLiveState, streamedLeagueId])

  useEffect(() => {
    const onPopState = () => setLocation({ pathname: window.location.pathname, search: window.location.search })
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = (path: string, replace = false) => {
    window.history[replace ? 'replaceState' : 'pushState']({}, '', path)
    setLocation({ pathname: window.location.pathname, search: window.location.search })
  }

  useEffect(() => {
    if (!authToken) {
      setIsAuthLoading(false)
      return
    }
    loadCurrentUser(authToken)
      .then(setAuthUser)
      .catch(() => {
        clearToken()
        setAuthToken(null)
      })
      .finally(() => setIsAuthLoading(false))
  }, [authToken])

  const handleAuthenticated = async (result: AuthResponse) => {
    storeToken(result.token)
    setAuthUser(result.user)
    setAuthToken(result.token)
    if (result.user.role === 'ADMIN') {
      navigate('/administration', true)
      return
    }
    const leagues = await loadRegisteredLeagues(result.token)
    navigate(leagues.length === 0 ? '/leagues/new' : leagues.length === 1 ? `/league?leagueId=${leagues[0].id}` : '/leagues', true)
  }

  const signOut = async () => {
    if (authToken) await logout(authToken).catch(() => undefined)
    clearToken()
    setAuthToken(null)
    setAuthUser(null)
    navigate('/login', true)
  }

  useEffect(() => {
    if (!shouldLoadLiveState) return
    const events = new EventSource(isLeagueBroadcast ? `/api/live-state/stream?leagueId=${streamedLeagueId}` : '/api/live-state/stream')

    events.addEventListener('live-state', (event) => {
      setLiveState(JSON.parse(event.data) as LiveStateResponse)
      setError(null)
    })

    return () => {
      events.close()
    }
  }, [isLeagueBroadcast, shouldLoadLiveState, streamedLeagueId])

  const clearTransitionTimers = () => {
    transitionTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    transitionTimersRef.current = []
  }

  const targetLatestEvent = liveState?.events?.[0]
  const eventTargetMatchup = targetLatestEvent ? findFocusedMatchup(liveState) : undefined
  const eventTargetTeam = targetLatestEvent ? liveState?.teams?.find((candidate) => candidate.managerId === targetLatestEvent.managerId) : undefined
  const isTotalPointsBroadcast = (liveState?.matchups?.length ?? 0) === 0 && (liveState?.teams?.length ?? 0) > 0
  const heldAutoMatchup = lastAutoMatchupId
    ? liveState?.matchups?.find((candidate) => candidate.id === lastAutoMatchupId)
    : undefined
  const heldAutoTeam = lastAutoMatchupId
    ? liveState?.teams?.find((candidate) => candidate.managerId === lastAutoMatchupId)
    : undefined
  const autoTargetMatchup = eventTargetMatchup ?? heldAutoMatchup ?? liveState?.matchups?.[0]
  const autoTargetTeam = eventTargetTeam ?? heldAutoTeam ?? liveState?.teams?.[0]
  const selectedTargetMatchup =
    broadcastFocus === 'multi' ? undefined : liveState?.matchups?.find((candidate) => candidate.id === broadcastFocus)
  const selectedTargetTeam =
    broadcastFocus === 'multi' ? undefined : liveState?.teams?.find((candidate) => candidate.managerId === broadcastFocus)
  const targetMatchup = selectedTargetMatchup ?? autoTargetMatchup
  const targetTeam = selectedTargetTeam ?? autoTargetTeam
  const focusedMatchupId = isTotalPointsBroadcast ? targetTeam?.managerId ?? null : targetMatchup?.id ?? null

  useEffect(() => {
    if (!targetLatestEvent || targetLatestEvent.id === lastSoundedEventIdRef.current) return
    lastSoundedEventIdRef.current = targetLatestEvent.id
    playPointChangeSound(targetLatestEvent.pointDelta)
  }, [targetLatestEvent?.id, targetLatestEvent?.pointDelta])

  useEffect(() => {
    const autoFocusId = isTotalPointsBroadcast ? eventTargetTeam?.managerId : eventTargetMatchup?.id
    if (targetLatestEvent && autoFocusId) {
      setLastAutoMatchupId(autoFocusId)
      return
    }
    if (!lastAutoMatchupId && autoFocusId) {
      setLastAutoMatchupId(autoFocusId)
    }
  }, [eventTargetMatchup?.id, eventTargetTeam?.managerId, isTotalPointsBroadcast, lastAutoMatchupId, targetLatestEvent?.id])

  useEffect(() => {
    clearTransitionTimers()

    if (!liveState || !focusedMatchupId || appView !== 'broadcast') {
      lastFocusedMatchupIdRef.current = null
      lastBroadcastFocusRef.current = broadcastFocus
      setBroadcastLiveState(liveState)
      setBroadcastStandings(liveState?.standings ?? null)
      setTransitioningToMatch(false)
      setRevealingMatch(false)
      setRevealLayout(null)
      setVisibleEventId(targetLatestEvent?.id ?? null)
      setHoldingPendingUpdates(false)
      return
    }

    const previousFocusedMatchupId = lastFocusedMatchupIdRef.current
    const previousBroadcastFocus = lastBroadcastFocusRef.current
    const firstBroadcastFocus = previousFocusedMatchupId === null
    const focusChanged = previousFocusedMatchupId !== null && previousFocusedMatchupId !== focusedMatchupId
    const userChangedFocus = previousBroadcastFocus !== broadcastFocus
    lastFocusedMatchupIdRef.current = focusedMatchupId
    lastBroadcastFocusRef.current = broadcastFocus

    if (userChangedFocus && !firstBroadcastFocus) {
      setBroadcastLiveState(liveState)
      setBroadcastStandings(liveState?.standings ?? null)
      setTransitioningToMatch(false)
      setRevealingMatch(false)
      setRevealLayout(null)
      setVisibleEventId(targetLatestEvent?.id ?? null)
      setHoldingPendingUpdates(false)
      return clearTransitionTimers
    }

    if (firstBroadcastFocus) {
      setBroadcastLiveState(liveState)
      setBroadcastStandings(liveState?.standings ?? null)
      setVisibleEventId(null)
      setHoldingPendingUpdates(true)
      setTransitioningToMatch(false)
      setRevealLayout(null)
      setRevealingMatch(true)
      const revealTimer = window.setTimeout(() => {
        setRevealingMatch(false)
        setVisibleEventId(targetLatestEvent?.id ?? null)
        setHoldingPendingUpdates(false)
        setBroadcastStandings(liveState.standings ?? null)
      }, MATCH_REVEAL_MS)
      transitionTimersRef.current = [revealTimer]
      return clearTransitionTimers
    }

    if (focusChanged) {
      setVisibleEventId(null)
      setHoldingPendingUpdates(false)
      setTransitioningToMatch(true)
      setRevealingMatch(false)
      const swapTimer = window.setTimeout(() => {
        setBroadcastLiveState(liveState)
        setRevealLayout(null)
        setHoldingPendingUpdates(true)
        setRevealingMatch(true)
      }, SCENE_SWAP_MS)
      const endTimer = window.setTimeout(() => {
        setTransitioningToMatch(false)
      }, SCENE_WIPE_MS)
      const revealTimer = window.setTimeout(() => {
        setRevealingMatch(false)
        setVisibleEventId(targetLatestEvent?.id ?? null)
        setHoldingPendingUpdates(false)
        setBroadcastStandings(liveState.standings ?? null)
      }, SCENE_SWAP_MS + MATCH_REVEAL_MS)
      transitionTimersRef.current = [swapTimer, endTimer, revealTimer]
      return clearTransitionTimers
    }

    setBroadcastLiveState(liveState)
    setBroadcastStandings(liveState.standings ?? null)
    setTransitioningToMatch(false)
    setRevealingMatch(false)
    setVisibleEventId(targetLatestEvent?.id ?? null)
    setHoldingPendingUpdates(false)

    return clearTransitionTimers
  }, [appView, broadcastFocus, focusedMatchupId, liveState, targetLatestEvent?.id])

  useLayoutEffect(() => {
    if (appView !== 'broadcast' || !scoreRef.current) {
      return
    }

    if (isTotalPointsBroadcast) {
      if (!totalHeadingRef.current) return
      const teamNameRect = totalHeadingRef.current.getBoundingClientRect()
      const scoreRect = scoreRef.current.getBoundingClientRect()
      const revealGap = 60
      const scoreReveal = toRevealRect(scoreRect, window.innerWidth / 2 + (teamNameRect.width + revealGap) / 2)
      setRevealLayout({
        home: toRevealRect(teamNameRect, window.innerWidth / 2 - (scoreRect.width + revealGap) / 2),
        score: { ...scoreReveal, top: scoreReveal.top + TOTAL_SCORE_REVEAL_Y_CORRECTION, revealY: scoreReveal.revealY - TOTAL_SCORE_REVEAL_Y_CORRECTION },
        away: toRevealRect(teamNameRect, window.innerWidth / 2),
      })
      return
    }

    if (!homeHeadingRef.current || !awayHeadingRef.current) return

    setRevealLayout({
      home: toRevealRect(homeHeadingRef.current.getBoundingClientRect(), window.innerWidth * 0.27),
      score: toScoreRevealRect(scoreRef.current.getBoundingClientRect()),
      away: toRevealRect(awayHeadingRef.current.getBoundingClientRect(), window.innerWidth * 0.73),
    })
  }, [appView, broadcastLiveState, focusedMatchupId, isTotalPointsBroadcast])

  const runAction = async (action: 'start' | 'advance' | 'reset') => {
    setIsBusy(true)
    try {
      const nextState = await postMockAction(action, authToken!)
      setLiveState(nextState)
      if (action === 'start') {
        setBroadcastFocus('multi')
        setAppView('broadcast')
        navigate('/broadcast')
      }
      if (action === 'reset') {
        setAppView('setup')
        navigate('/administration')
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

    if (leagueType === 'CLASSIC') {
      setLeagueDiscovery(null)
      setLeagueError('Classic league discovery is not built yet. Start the live broadcast to record its head-to-head matchups.')
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

  const startLiveBroadcast = async () => {
    const normalizedLeagueId = leagueId.trim()
    if (!normalizedLeagueId) {
      setLeagueError('Enter your league id before starting a live broadcast.')
      return
    }

    enablePointChangeSound()
    setIsBusy(true)
    try {
      const nextState = await startRealBroadcast(normalizedLeagueId, leagueType, scoringType, authToken!)
      setLiveState(nextState)
      setBroadcastFocus('multi')
      setAppView('broadcast')
      navigate(`/broadcast?leagueId=${encodeURIComponent(normalizedLeagueId)}`)
      setError(null)
      setLeagueError(null)
    } catch (requestError) {
      setLeagueError(requestError instanceof Error ? requestError.message : 'Unable to start live broadcast.')
    } finally {
      setIsBusy(false)
    }
  }

  const startComprehensiveMockBroadcast = async () => {
    setIsBusy(true)
    try {
      const nextState = await startComprehensiveMock(authToken!)
      setLiveState(nextState)
      setBroadcastFocus('multi')
      setAppView('broadcast')
      navigate('/broadcast')
      setError(null)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to start comprehensive mock broadcast.')
    } finally {
      setIsBusy(false)
    }
  }

  if (isAuthLoading) {
    return <main className="account-shell"><p>Checking your session…</p></main>
  }

  if (!authUser) {
    if (location.pathname !== '/login') navigate('/login', true)
    return <AuthScreen onAuthenticated={handleAuthenticated} />
  }

  if (authUser.role !== 'ADMIN' && location.pathname !== '/broadcast') {
    return <CustomerDashboard token={authToken!} user={authUser} pathname={location.pathname} search={location.search} onNavigate={navigate} onSignOut={() => void signOut()} />
  }

  const startTotalPointsMockBroadcast = async () => {
    setIsBusy(true)
    try {
      const nextState = await startTotalPointsMock(authToken!)
      setLiveState(nextState)
      setBroadcastFocus('multi')
      setAppView('broadcast')
      navigate('/broadcast')
      setError(null)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to start total-points mock broadcast.')
    } finally {
      setIsBusy(false)
    }
  }

  if (authUser.role === 'ADMIN' && (location.pathname === '/league' || location.pathname === '/leagues' || location.pathname === '/leagues/new')) {
    return <CustomerDashboard token={authToken!} user={authUser} pathname={location.pathname} search={location.search} onNavigate={navigate} onSignOut={() => void signOut()} />
  }

  if (authUser.role === 'ADMIN' && location.pathname !== '/administration' && location.pathname !== '/broadcast') navigate('/administration', true)

  const totalPointsBroadcast = (liveState?.matchups?.length ?? 0) === 0 && (liveState?.teams?.length ?? 0) > 0
  if (!liveState || (!targetMatchup && !totalPointsBroadcast)) {
    return (
      <main className="broadcast-shell loading-shell">
        <div>
          <Radio size={28} />
          <h1>Fantasy Broadcast</h1>
          <p>{error ? error : 'Loading live broadcast state...'}</p>
        </div>
      </main>
    )
  }

  const displayLiveState = appView === 'broadcast' ? broadcastLiveState ?? liveState : liveState
  const displayStandings = appView === 'broadcast' ? broadcastStandings ?? displayLiveState.standings ?? [] : liveState.standings ?? []
  const autoDisplayMatchup = findFocusedMatchup(displayLiveState)
  const selectedDisplayMatchup =
    broadcastFocus === 'multi' ? undefined : displayLiveState.matchups?.find((candidate) => candidate.id === broadcastFocus)
  const matchup = selectedDisplayMatchup ?? autoDisplayMatchup ?? targetMatchup
  const latestCommentary = displayLiveState.commentary?.[0]
  const leaderName = matchup && matchup.leaderManagerId === matchup.home.managerId
    ? matchup.home.displayName
    : matchup && matchup.leaderManagerId === matchup.away.managerId
      ? matchup.away.displayName
      : 'No one'

  if (location.pathname === '/broadcast' && (appView === 'broadcast' || authUser.role !== 'ADMIN')) {
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
        totalTeamNameRef={totalTeamNameRef}
        totalHeadingRef={totalHeadingRef}
        standings={displayStandings}
        holdingPendingUpdates={holdingPendingUpdates}
        onBack={() => { setAppView('setup'); navigate(authUser.role === 'ADMIN' ? '/administration' : '/leagues') }}
        onSelectFocus={setBroadcastFocus}
      />
    )
  }

  return (
    <main className="broadcast-shell administration-shell">
      <header className="broadcast-header administration-header">
        <div>
          <span className="kicker">
            <Radio size={16} />
            Gameweek {liveState.gameweek}
          </span>
          <h1>Fantasy Broadcast Administration</h1>
        </div>
        <div className="account-nav administration-account-nav"><span>Administrator · {authUser.email}</span><button className="secondary-action" onClick={() => void signOut()}>Sign out</button></div>
      </header>

      <AdminLeagueRegistry token={authToken!} onOpenLeague={(selectedLeagueId) => navigate(`/league?leagueId=${selectedLeagueId}`)} />
      <BroadcastScheduleManager token={authToken!} />

      <section className="league-discovery administration-card" aria-label="FPL league setup">
        <div className="discovery-form">
          <div>
            <span className="kicker">
              <Database size={16} />
              FPL league setup
            </span>
            <h2>League Data Check</h2>
          </div>
          <form
            className="administration-check-form"
            onSubmit={(event) => {
              event.preventDefault()
              void inspectLeague()
            }}
          >
            <div className="administration-form-field"><label htmlFor="league-id">League ID</label><input
              id="league-id" inputMode="numeric" value={leagueId} onChange={(event) => setLeagueId(event.target.value)} placeholder="49824"
            /></div>
            <div className="administration-form-field"><label htmlFor="league-type">League type</label><select id="league-type" className="administration-select" value={leagueType} onChange={(event) => setLeagueType(event.target.value as FplLeagueType)}><option value="DRAFT">Draft</option><option value="CLASSIC">Classic</option></select></div>
            <div className="administration-form-field"><label htmlFor="scoring-type">Scoring type</label><select id="scoring-type" className="administration-select" value={scoringType} onChange={(event) => setScoringType(event.target.value as FplLeagueScoring)}><option value="H2H">Head-to-head</option><option value="TOTAL_POINTS">Total points</option></select></div>
            <div className="administration-form-actions">
              <button type="submit" disabled={isLeagueLoading}>
                <Search size={18} />
                Load
              </button>
              <button type="button" className="secondary-action" disabled={isLeagueLoading} onClick={inspectMockLeague}>
                <FlaskConical size={18} />
                Test
              </button>
            </div>
          </form>
        </div>
        {leagueType === 'CLASSIC' && (
          <p className="discovery-error">Classic league discovery is not built yet; live head-to-head recording is available.</p>
        )}
        {leagueError && <p className="discovery-error">{leagueError}</p>}
        {leagueDiscovery ? <LeagueDiscoverySummary discovery={leagueDiscovery} /> : null}
      </section>

      <section className="controls-row administration-controls" aria-label="Broadcast controls">
        <button type="button" onClick={startLiveBroadcast} disabled={isBusy || isLeagueLoading}>
          <Radio size={18} />
          Start live broadcast
        </button>
        <button type="button" onClick={() => runAction('start')} disabled={isBusy}>
          <Activity size={18} />
          Start mock broadcast
        </button>
        <button type="button" onClick={startComprehensiveMockBroadcast} disabled={isBusy}>
          <FlaskConical size={18} />
          Start comprehensive test
        </button>
        <button type="button" onClick={startTotalPointsMockBroadcast} disabled={isBusy}>
          <FlaskConical size={18} />
          Start total-points test
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
      </section>
    </main>
  )
}

export default App
