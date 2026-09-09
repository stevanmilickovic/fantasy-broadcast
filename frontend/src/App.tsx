import { Radio } from 'lucide-react'
import { useEffect, useState } from 'react'
import { loadLeagueDiscovery, loadMockLeagueDiscovery } from './api/fplDiscoveryApi'
import { postMockAction, startComprehensiveMock, startRealBroadcast, startTotalPointsMock, type FplLeagueType, type MockNarrationMode } from './api/liveApi'
import { BroadcastMatchday } from './components/broadcast/BroadcastMatchday'
import { AdministrationScreen } from './components/administration/AdministrationScreen'
import { AuthScreen } from './components/customer/AuthScreen'
import { CustomerDashboard } from './components/customer/CustomerDashboard'
import { WelcomePage } from './components/customer/WelcomePage'
import { useAuthSession } from './hooks/useAuthSession'
import { useBroadcastEventQueue } from './hooks/useBroadcastEventQueue'
import { useBroadcastFocus } from './hooks/useBroadcastFocus'
import { useBroadcastPresentation } from './hooks/useBroadcastPresentation'
import { useBrowserNavigation } from './hooks/useBrowserNavigation'
import { useLiveState } from './hooks/useLiveState'
import { useScreenWakeLock } from './hooks/useScreenWakeLock'
import type { LeagueDiscoveryState } from './types/fpl'
import type { AppView, BroadcastFocus } from './types/live'
import { findFocusedMatchup } from './utils/broadcast'
import { enablePointChangeSound } from './utils/broadcastSound'
import './App.css'

function App() {
  const { location, navigate } = useBrowserNavigation()
  const { user: authUser, isLoading: isAuthLoading, handleAuthenticated, signOut } = useAuthSession(navigate)
  const streamedLeagueId = Number(new URLSearchParams(location.search).get('leagueId')) || undefined
  const [isBusy, setIsBusy] = useState(false)
  const [leagueId, setLeagueId] = useState('49824')
  const [leagueType, setLeagueType] = useState<FplLeagueType>('DRAFT')
  const [leagueDiscovery, setLeagueDiscovery] = useState<LeagueDiscoveryState | null>(null)
  const [mockNarrationMode, setMockNarrationMode] = useState<MockNarrationMode>('NONE')
  const [leagueError, setLeagueError] = useState<string | null>(null)
  const [isLeagueLoading, setIsLeagueLoading] = useState(false)
  const [appView, setAppView] = useState<AppView>('setup')
  const [broadcastFocus, setBroadcastFocus] = useState<BroadcastFocus>('multi')
  const isBroadcastRoute = location.pathname === '/broadcast'
  const isBroadcastVisible = Boolean(authUser) && isBroadcastRoute && (
    appView === 'broadcast' || authUser?.role !== 'ADMIN'
  )
  useScreenWakeLock(isBroadcastVisible)
  const isLeagueBroadcast = location.pathname === '/broadcast' && streamedLeagueId !== undefined
  const shouldLoadLiveState = Boolean(authUser) && (authUser?.role === 'ADMIN' || isLeagueBroadcast)
  const { liveState, error, setLiveState, setError } = useLiveState({
    enabled: shouldLoadLiveState,
    leagueId: isLeagueBroadcast ? streamedLeagueId : undefined,
  })
  const {
    activeEvents: activeBroadcastEvents,
    activeLiveState,
    hasPendingNotifications,
    latestEvent: targetLatestEvent,
    reset: resetBroadcastEventQueue,
  } = useBroadcastEventQueue(liveState)
  const {
    targetMatchup,
    focusedId: focusedMatchupId,
    isTotalPointsBroadcast,
    showingLeaderboard: showingLiveLeaderboard,
    dismissLeaderboard: dismissLiveLeaderboard,
    reset: resetBroadcastFocus,
  } = useBroadcastFocus({
    liveState,
    latestEvent: targetLatestEvent,
    selectedFocus: broadcastFocus,
    isBroadcastRoute,
  })
  const {
    liveState: broadcastLiveState,
    standings: broadcastStandings,
    displayedFocusId,
    transitioningToMatch,
    revealingMatch,
    revealLayout,
    visibleEventId,
    holdingPendingUpdates,
    displayingLeaderboard: displayingLiveLeaderboard,
    leaderboardRevealLayout,
    homeHeadingRef,
    awayHeadingRef,
    scoreRef,
    totalTeamNameRef,
    totalHeadingRef,
    leaderboardHeadingRef,
    reset: resetBroadcastPresentation,
    hideDisplayedLeaderboard,
  } = useBroadcastPresentation({
    liveState,
    activeLiveState,
    hasPendingNotifications,
    focusedId: focusedMatchupId,
    selectedFocus: broadcastFocus,
    latestEventId: targetLatestEvent?.id,
    showingLeaderboard: showingLiveLeaderboard,
    isTotalPointsBroadcast,
    isBroadcastRoute,
  })

  useEffect(() => {
    if (isAuthLoading) return
    if (location.pathname === '/reset-password') return
    const publicRoutes = ['/', '/login', '/register', '/reset-password']
    if (!authUser && !publicRoutes.includes(location.pathname)) {
      navigate('/login', true)
      return
    }
    if (authUser && ['/', '/login', '/register'].includes(location.pathname)) {
      navigate(authUser.role === 'ADMIN' ? '/administration' : '/leagues', true)
      return
    }
    const customerRoutes = ['/league', '/leagues', '/leagues/new', '/leagues/checkout']
    const isKnownAdminRoute = location.pathname === '/administration' || location.pathname === '/broadcast'
    if (authUser?.role === 'ADMIN' && !isKnownAdminRoute && !customerRoutes.includes(location.pathname)) {
      navigate('/administration', true)
    }
  }, [authUser, isAuthLoading, location.pathname, navigate])

  const resetBroadcastPlayback = () => {
    resetBroadcastEventQueue()
    resetBroadcastFocus()
    resetBroadcastPresentation()
  }

  const runAction = async (action: 'start' | 'advance' | 'reset') => {
    setIsBusy(true)
    try {
		if (action === 'start') resetBroadcastPlayback()
      const nextState = await postMockAction(action)
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
		resetBroadcastPlayback()
      const nextState = await startRealBroadcast(normalizedLeagueId, leagueType)
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
		resetBroadcastPlayback()
      const nextState = await startComprehensiveMock(mockNarrationMode)
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

  if (!authUser && location.pathname === '/') {
    return <WelcomePage onNavigate={navigate} />
  }

  if (!authUser || location.pathname === '/reset-password') {
    return <AuthScreen pathname={location.pathname} search={location.search} onAuthenticated={handleAuthenticated} onNavigate={navigate} />
  }

  if (authUser.role !== 'ADMIN' && location.pathname !== '/broadcast') {
    return <CustomerDashboard user={authUser} pathname={location.pathname} search={location.search} onNavigate={navigate} onSignOut={() => void signOut()} />
  }

  const startTotalPointsMockBroadcast = async () => {
    setIsBusy(true)
    try {
		resetBroadcastPlayback()
      const nextState = await startTotalPointsMock(mockNarrationMode)
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

  if (authUser.role === 'ADMIN' && (location.pathname === '/league' || location.pathname === '/leagues' || location.pathname === '/leagues/new' || location.pathname === '/leagues/checkout')) {
    return <CustomerDashboard user={authUser} pathname={location.pathname} search={location.search} onNavigate={navigate} onSignOut={() => void signOut()} />
  }

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

  const displayLiveStateBase = isBroadcastRoute ? broadcastLiveState ?? liveState : liveState
  const displayLiveState = isBroadcastRoute
    ? { ...displayLiveStateBase, events: activeBroadcastEvents }
    : displayLiveStateBase
  const displayStandings = isBroadcastRoute ? broadcastStandings ?? displayLiveState.standings ?? [] : liveState.standings ?? []
  const autoDisplayMatchup = findFocusedMatchup(displayLiveState)
  const displayedMatchup = displayedFocusId ? displayLiveState.matchups?.find((candidate) => candidate.id === displayedFocusId) : undefined
  const selectedDisplayMatchup =
    broadcastFocus === 'multi' ? undefined : displayLiveState.matchups?.find((candidate) => candidate.id === broadcastFocus)
  const matchup = selectedDisplayMatchup ?? displayedMatchup ?? (displayLiveState.events?.length ? autoDisplayMatchup : targetMatchup ?? autoDisplayMatchup)
  const latestCommentary = displayLiveState.commentary?.[0]
  const leaderName = matchup && matchup.leaderManagerId === matchup.home.managerId
    ? matchup.home.displayName
    : matchup && matchup.leaderManagerId === matchup.away.managerId
      ? matchup.away.displayName
      : 'No one'

  if (location.pathname === '/broadcast' && (appView === 'broadcast' || authUser.role !== 'ADMIN')) {
    return (
      <BroadcastMatchday
		authToken=""
        displayLiveState={displayLiveState}
        matchup={matchup}
        latestCommentaryId={latestCommentary?.id}
        latestCommentaryText={latestCommentary?.text ?? 'Waiting for commentary.'}
        latestCommentaryStatus={latestCommentary?.status ?? 'WAITING'}
        leaderName={leaderName}
        broadcastFocus={broadcastFocus}
        automaticFocus={displayedFocusId ?? focusedMatchupId ?? 'multi'}
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
        showingLiveLeaderboard={displayingLiveLeaderboard}
        leaderboardRevealLayout={leaderboardRevealLayout}
        leaderboardHeadingRef={leaderboardHeadingRef}
        holdingPendingUpdates={holdingPendingUpdates}
        onBack={() => { setAppView('setup'); navigate(authUser.role === 'ADMIN' ? '/administration' : '/leagues') }}
        onSelectFocus={(focus) => { dismissLiveLeaderboard(); hideDisplayedLeaderboard(); setBroadcastFocus(focus) }}
      />
    )
  }

  return (
    <AdministrationScreen
      session={{
        user: authUser,
        onOpenLeague: (selectedLeagueId) => navigate(`/league?leagueId=${selectedLeagueId}`),
        onSignOut: () => void signOut(),
      }}
      leagueSetup={{
        leagueId,
        leagueType,
        leagueDiscovery,
        leagueError,
        isLeagueLoading,
        onLeagueIdChange: setLeagueId,
        onLeagueTypeChange: setLeagueType,
        onInspectLeague: () => void inspectLeague(),
        onInspectMockLeague: () => void inspectMockLeague(),
      }}
      broadcastControls={{
        liveState,
        mockNarrationMode,
        isBusy,
        onMockNarrationModeChange: setMockNarrationMode,
        onStartLiveBroadcast: () => void startLiveBroadcast(),
        onStartMockBroadcast: () => void runAction('start'),
        onStartComprehensiveMockBroadcast: () => void startComprehensiveMockBroadcast(),
        onStartTotalPointsMockBroadcast: () => void startTotalPointsMockBroadcast(),
        onShowLiveBroadcast: () => setAppView('broadcast'),
        onAdvanceBroadcast: () => void runAction('advance'),
        onResetBroadcast: () => void runAction('reset'),
      }}
    />
  )
}

export default App
