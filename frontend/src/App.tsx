import { Radio } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { loadLeagueDiscovery, loadMockLeagueDiscovery } from './api/fplDiscoveryApi'
import { postMockAction, startComprehensiveMock, startRealBroadcast, startTotalPointsMock, type FplLeagueType, type MockNarrationMode } from './api/liveApi'
import { BroadcastMatchday } from './components/broadcast/BroadcastMatchday'
import { AdministrationScreen } from './components/administration/AdministrationScreen'
import { AuthScreen } from './components/customer/AuthScreen'
import { CustomerDashboard } from './components/customer/CustomerDashboard'
import { useAuthSession } from './hooks/useAuthSession'
import { useBrowserNavigation } from './hooks/useBrowserNavigation'
import { useLiveState } from './hooks/useLiveState'
import type { LeagueDiscoveryState } from './types/fpl'
import type { AppView, BroadcastFocus, FantasyEventView, LiveStateResponse, RevealLayout, RevealRect } from './types/live'
import type { LiveStandingView } from './types/live'
import { findFocusedMatchup, toRevealRect, toScoreRevealRect, TOTAL_POINTS_REVEAL_TEAM_SCALE } from './utils/broadcast'
import { enablePointChangeSound, playNarrationAudio, playPointChangeSound } from './utils/broadcastSound'
import './App.css'

const SCENE_WIPE_MS = 1600
const SCENE_SWAP_MS = SCENE_WIPE_MS / 2
const MATCH_REVEAL_MS = 1900
const TOTAL_SCORE_REVEAL_Y_CORRECTION = 1
const INACTIVITY_ROTATION_MS = 60_000
const IDLE_TRANSITIONS_BEFORE_LEADERBOARD = 4
const QUEUED_NOTIFICATION_START_GRACE_MS = 450
const MAX_PENDING_BROADCAST_GROUPS = 3

type BroadcastEventGroup = { id: string; events: FantasyEventView[]; totalChange: number }

const eventGroupId = (state: LiveStateResponse, event: FantasyEventView) =>
  state.matchups.find((matchup) => [matchup.home.managerId, matchup.away.managerId].includes(event.managerId))?.id ?? `team-${event.managerId}`

const visibleNotificationGroups = (groups: BroadcastEventGroup[], voiceNarrationEnabled: boolean | undefined) =>
  voiceNarrationEnabled ? groups.filter((group) => group.events.some((event) => event.type !== 'AUTO_SUB')) : groups

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
  const [broadcastLiveState, setBroadcastLiveState] = useState<LiveStateResponse | null>(null)
  const [broadcastStandings, setBroadcastStandings] = useState<LiveStandingView[] | null>(null)
  const [activeBroadcastGroup, setActiveBroadcastGroup] = useState<BroadcastEventGroup | null>(null)
  const [pendingBroadcastGroups, setPendingBroadcastGroups] = useState<BroadcastEventGroup[]>([])
  const [displayedFocusId, setDisplayedFocusId] = useState<string | null>(null)
  const [transitioningToMatch, setTransitioningToMatch] = useState(false)
  const [revealingMatch, setRevealingMatch] = useState(false)
  const [revealLayout, setRevealLayout] = useState<RevealLayout | null>(null)
  const [visibleEventId, setVisibleEventId] = useState<string | null>(null)
  const [holdingPendingUpdates, setHoldingPendingUpdates] = useState(false)
  const [showingLiveLeaderboard, setShowingLiveLeaderboard] = useState(false)
  const [displayingLiveLeaderboard, setDisplayingLiveLeaderboard] = useState(false)
  const [leaderboardRevealLayout, setLeaderboardRevealLayout] = useState<RevealRect | null>(null)
  const [lastAutoMatchupId, setLastAutoMatchupId] = useState<string | null>(null)
  const lastFocusedMatchupIdRef = useRef<string | null>(null)
  const lastSoundedEventIdRef = useRef<string | null>(null)
  const lastNarrationAudioIdRef = useRef<string | null>(null)
  const lastBroadcastFocusRef = useRef<BroadcastFocus>('multi')
  const transitionTimersRef = useRef<number[]>([])
  const queuedNotificationStartTimerRef = useRef<number | null>(null)
  const inactivityRotationTimerRef = useRef<number | null>(null)
  const lastBackendEventAtRef = useRef(Date.now())
  const idleTransitionCountRef = useRef(0)
  const recentlyShownFocusesRef = useRef(new Map<string, number>())
  const latestLiveStateRef = useRef<LiveStateResponse | null>(null)
  const receivedBroadcastEventIdsRef = useRef(new Set<string>())
  const homeHeadingRef = useRef<HTMLHeadingElement>(null)
  const awayHeadingRef = useRef<HTMLHeadingElement>(null)
  const scoreRef = useRef<HTMLElement>(null)
  const totalTeamNameRef = useRef<HTMLSpanElement>(null)
  const totalHeadingRef = useRef<HTMLHeadingElement>(null)
  const leaderboardHeadingRef = useRef<HTMLHeadingElement>(null)
  const isBroadcastRoute = location.pathname === '/broadcast'
  const isLeagueBroadcast = location.pathname === '/broadcast' && streamedLeagueId !== undefined
  const shouldLoadLiveState = Boolean(authUser) && (authUser?.role === 'ADMIN' || isLeagueBroadcast)
  const { liveState, error, setLiveState, setError } = useLiveState({
    enabled: shouldLoadLiveState,
    leagueId: isLeagueBroadcast ? streamedLeagueId : undefined,
  })

  useEffect(() => {
    if (isAuthLoading) return
    if (!authUser && location.pathname !== '/login') {
      navigate('/login', true)
      return
    }
    const customerRoutes = ['/league', '/leagues', '/leagues/new']
    const isKnownAdminRoute = location.pathname === '/administration' || location.pathname === '/broadcast'
    if (authUser?.role === 'ADMIN' && !isKnownAdminRoute && !customerRoutes.includes(location.pathname)) {
      navigate('/administration', true)
    }
  }, [authUser, isAuthLoading, location.pathname, navigate])

  const clearTransitionTimers = () => {
    transitionTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    transitionTimersRef.current = []
  }

  const resetBroadcastPlayback = () => {
    clearTransitionTimers()
    if (queuedNotificationStartTimerRef.current) window.clearTimeout(queuedNotificationStartTimerRef.current)
    receivedBroadcastEventIdsRef.current.clear()
    lastFocusedMatchupIdRef.current = null
    lastBroadcastFocusRef.current = 'multi'
    setActiveBroadcastGroup(null)
    setPendingBroadcastGroups([])
    setLastAutoMatchupId(null)
    setDisplayedFocusId(null)
    setVisibleEventId(null)
    setHoldingPendingUpdates(false)
    setShowingLiveLeaderboard(false)
    setDisplayingLiveLeaderboard(false)
    setLeaderboardRevealLayout(null)
    idleTransitionCountRef.current = 0
    setTransitioningToMatch(false)
    setRevealingMatch(false)
    setRevealLayout(null)
  }

  useEffect(() => {
    const incoming = (liveState?.events ?? []).filter((event) => !receivedBroadcastEventIdsRef.current.has(event.id))
    if (incoming.length === 0) return
    incoming.forEach((event) => receivedBroadcastEventIdsRef.current.add(event.id))
    const mergeGroups = (current: BroadcastEventGroup[]) => {
      const groups = new Map(current.map((group) => [group.id, group]))
      for (const event of incoming) {
        const id = eventGroupId(liveState!, event)
        const group = groups.get(id) ?? { id, events: [], totalChange: 0 }
        groups.set(id, { ...group, events: [...group.events, event].sort((left, right) => Math.abs(right.pointDelta) - Math.abs(left.pointDelta)), totalChange: group.totalChange + Math.abs(event.pointDelta) })
      }
		return visibleNotificationGroups([...groups.values()].sort((left, right) => right.totalChange - left.totalChange), liveState!.voiceNarrationEnabled).slice(0, MAX_PENDING_BROADCAST_GROUPS)
    }
    if ((liveState?.commentary?.length ?? 0) > 0) {
      const [highlight, ...queued] = mergeGroups([])
      if (highlight) setActiveBroadcastGroup(highlight)
      setPendingBroadcastGroups((current) => [...queued, ...current.filter((group) => !queued.some((candidate) => candidate.id === group.id) && group.id !== highlight?.id)].slice(0, MAX_PENDING_BROADCAST_GROUPS))
      return
    }
    setPendingBroadcastGroups(mergeGroups)
  }, [liveState?.events])

  useEffect(() => {
    if (!liveState?.commentary?.[0] || liveState.events.length === 0) return
    const groups = new Map<string, BroadcastEventGroup>()
    for (const event of liveState.events) {
      const id = eventGroupId(liveState, event)
      const group = groups.get(id) ?? { id, events: [], totalChange: 0 }
      groups.set(id, { ...group, events: [...group.events, event].sort((left, right) => Math.abs(right.pointDelta) - Math.abs(left.pointDelta)), totalChange: group.totalChange + Math.abs(event.pointDelta) })
    }
	const [highlight, ...queued] = visibleNotificationGroups([...groups.values()].sort((left, right) => right.totalChange - left.totalChange), liveState.voiceNarrationEnabled)
    if (!highlight) return
    setActiveBroadcastGroup(highlight)
    setPendingBroadcastGroups((current) => [...queued, ...current.filter((group) => !queued.some((candidate) => candidate.id === group.id) && group.id !== highlight.id)].slice(0, MAX_PENDING_BROADCAST_GROUPS))
  }, [liveState?.commentary?.[0]?.id])

  useEffect(() => {
    if (activeBroadcastGroup || pendingBroadcastGroups.length === 0) return
    queuedNotificationStartTimerRef.current = window.setTimeout(() => {
      const [next, ...remaining] = pendingBroadcastGroups
      setActiveBroadcastGroup(next)
      setPendingBroadcastGroups(remaining)
      queuedNotificationStartTimerRef.current = null
    }, QUEUED_NOTIFICATION_START_GRACE_MS)
    return () => {
      if (queuedNotificationStartTimerRef.current) window.clearTimeout(queuedNotificationStartTimerRef.current)
      queuedNotificationStartTimerRef.current = null
    }
  }, [activeBroadcastGroup, pendingBroadcastGroups])

  useEffect(() => {
    if (!activeBroadcastGroup) return
    const timer = window.setTimeout(() => setActiveBroadcastGroup(null), 10_000)
    return () => window.clearTimeout(timer)
  }, [activeBroadcastGroup?.id])

  const activeBroadcastEvents = activeBroadcastGroup?.events ?? []
  const targetLatestEvent = activeBroadcastEvents[0]
  const eventTargetMatchup = targetLatestEvent ? findFocusedMatchup(liveState ? { ...liveState, events: [targetLatestEvent] } : null) : undefined
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
    latestLiveStateRef.current = liveState
  }, [liveState])

  useEffect(() => {
    if (focusedMatchupId) recentlyShownFocusesRef.current.set(focusedMatchupId, Date.now())
  }, [focusedMatchupId])

  useEffect(() => {
    if (!targetLatestEvent || targetLatestEvent.id === lastSoundedEventIdRef.current) return
    lastSoundedEventIdRef.current = targetLatestEvent.id
    playPointChangeSound(targetLatestEvent.pointDelta)
  }, [targetLatestEvent?.id, targetLatestEvent?.pointDelta])

  const latestNarration = liveState?.commentary?.[0]
  useEffect(() => {
    if (!latestNarration?.audioUrl || latestNarration.id === lastNarrationAudioIdRef.current) return
    lastNarrationAudioIdRef.current = latestNarration.id
    void playNarrationAudio(latestNarration.audioUrl)
  }, [latestNarration?.audioUrl, latestNarration?.id])

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
    if (targetLatestEvent) {
      lastBackendEventAtRef.current = Date.now()
      idleTransitionCountRef.current = 0
      setShowingLiveLeaderboard(false)
    }
    if (inactivityRotationTimerRef.current) window.clearTimeout(inactivityRotationTimerRef.current)
    if (!isBroadcastRoute || broadcastFocus !== 'multi' || !focusedMatchupId) return

    const delay = Math.max(0, INACTIVITY_ROTATION_MS - (Date.now() - lastBackendEventAtRef.current))
    inactivityRotationTimerRef.current = window.setTimeout(() => {
      const state = latestLiveStateRef.current
      if (!state) return
      const candidates = isTotalPointsBroadcast
        ? state.teams?.map((team) => team.managerId) ?? []
        : state.matchups?.map((matchup) => matchup.id) ?? []
      if (candidates.length < 2) return
      if (!isTotalPointsBroadcast && !showingLiveLeaderboard && idleTransitionCountRef.current >= IDLE_TRANSITIONS_BEFORE_LEADERBOARD) {
        idleTransitionCountRef.current = 0
        lastBackendEventAtRef.current = Date.now()
        setShowingLiveLeaderboard(true)
        return
      }
      const nextFocus = candidates
        .filter((candidate) => candidate !== focusedMatchupId)
        .sort((left, right) => (recentlyShownFocusesRef.current.get(left) ?? 0) - (recentlyShownFocusesRef.current.get(right) ?? 0))[0]
      if (!nextFocus) return
      lastBackendEventAtRef.current = Date.now()
      recentlyShownFocusesRef.current.set(nextFocus, Date.now())
      if (!isTotalPointsBroadcast) idleTransitionCountRef.current += 1
      setShowingLiveLeaderboard(false)
      setLastAutoMatchupId(nextFocus)
    }, delay)

    return () => {
      if (inactivityRotationTimerRef.current) window.clearTimeout(inactivityRotationTimerRef.current)
      inactivityRotationTimerRef.current = null
    }
  }, [broadcastFocus, focusedMatchupId, isBroadcastRoute, isTotalPointsBroadcast, showingLiveLeaderboard, targetLatestEvent?.id])

  const presentationFocusId = showingLiveLeaderboard && !isTotalPointsBroadcast ? 'live-leaderboard' : focusedMatchupId

  useEffect(() => {
    clearTransitionTimers()

    if (!liveState || !presentationFocusId || !isBroadcastRoute) {
      lastFocusedMatchupIdRef.current = null
      lastBroadcastFocusRef.current = broadcastFocus
      setBroadcastLiveState(liveState)
      setBroadcastStandings(liveState?.standings ?? null)
      setTransitioningToMatch(false)
      setRevealingMatch(false)
      setRevealLayout(null)
      setVisibleEventId(targetLatestEvent?.id ?? null)
      setHoldingPendingUpdates(false)
      setDisplayingLiveLeaderboard(showingLiveLeaderboard)
      setDisplayedFocusId(focusedMatchupId)
      return
    }

    const previousFocusedMatchupId = lastFocusedMatchupIdRef.current
    const previousBroadcastFocus = lastBroadcastFocusRef.current
    const firstBroadcastFocus = previousFocusedMatchupId === null
    const focusChanged = previousFocusedMatchupId !== null && previousFocusedMatchupId !== presentationFocusId
    const userChangedFocus = previousBroadcastFocus !== broadcastFocus
    lastFocusedMatchupIdRef.current = presentationFocusId
    lastBroadcastFocusRef.current = broadcastFocus

    if (userChangedFocus && !firstBroadcastFocus && !isTotalPointsBroadcast) {
      setBroadcastLiveState(liveState)
      setBroadcastStandings(liveState?.standings ?? null)
      setDisplayedFocusId(focusedMatchupId)
      setTransitioningToMatch(false)
      setRevealingMatch(false)
      setRevealLayout(null)
      setVisibleEventId(targetLatestEvent?.id ?? null)
      setHoldingPendingUpdates(false)
      setDisplayingLiveLeaderboard(showingLiveLeaderboard)
      return clearTransitionTimers
    }

    if (firstBroadcastFocus) {
      setBroadcastLiveState(liveState)
      setBroadcastStandings(liveState?.standings ?? null)
      setDisplayedFocusId(focusedMatchupId)
      setVisibleEventId(null)
      setHoldingPendingUpdates(true)
      setDisplayingLiveLeaderboard(showingLiveLeaderboard)
      setTransitioningToMatch(false)
      setRevealLayout(null)
      setRevealingMatch(false)
      const revealStartTimer = window.setTimeout(() => setRevealingMatch(true), 16)
      const revealTimer = window.setTimeout(() => {
        setRevealingMatch(false)
        setVisibleEventId(targetLatestEvent?.id ?? null)
        setHoldingPendingUpdates(false)
        setBroadcastStandings(liveState.standings ?? null)
      }, MATCH_REVEAL_MS)
      transitionTimersRef.current = [revealStartTimer, revealTimer]
      return clearTransitionTimers
    }

    if (focusChanged) {
      setVisibleEventId(null)
      setHoldingPendingUpdates(false)
      setTransitioningToMatch(true)
      setRevealingMatch(false)
      const swapTimer = window.setTimeout(() => {
        setBroadcastLiveState(liveState)
        setDisplayedFocusId(focusedMatchupId)
        setBroadcastStandings(liveState.standings ?? null)
        setDisplayingLiveLeaderboard(showingLiveLeaderboard)
        setRevealLayout(null)
        setHoldingPendingUpdates(true)
      }, SCENE_SWAP_MS)
      const revealStartTimer = window.setTimeout(() => setRevealingMatch(true), SCENE_SWAP_MS + 16)
      const endTimer = window.setTimeout(() => {
        setTransitioningToMatch(false)
      }, SCENE_WIPE_MS)
      const revealTimer = window.setTimeout(() => {
        setRevealingMatch(false)
        setVisibleEventId(targetLatestEvent?.id ?? null)
        setHoldingPendingUpdates(false)
        setBroadcastStandings(liveState.standings ?? null)
      }, SCENE_SWAP_MS + MATCH_REVEAL_MS)
      transitionTimersRef.current = [swapTimer, revealStartTimer, endTimer, revealTimer]
      return clearTransitionTimers
    }

    setBroadcastLiveState(liveState)
    setBroadcastStandings(liveState.standings ?? null)
    setDisplayedFocusId(focusedMatchupId)
    setTransitioningToMatch(false)
    setRevealingMatch(false)
    setVisibleEventId(targetLatestEvent?.id ?? null)
    setHoldingPendingUpdates(false)
    setDisplayingLiveLeaderboard(showingLiveLeaderboard)

    return clearTransitionTimers
  }, [broadcastFocus, focusedMatchupId, isBroadcastRoute, isTotalPointsBroadcast, liveState, presentationFocusId, showingLiveLeaderboard, targetLatestEvent?.id])

  useLayoutEffect(() => {
    if (!isBroadcastRoute) {
      return
    }

    if (displayingLiveLeaderboard) {
      if (!leaderboardHeadingRef.current) return
      setLeaderboardRevealLayout(toRevealRect(leaderboardHeadingRef.current.getBoundingClientRect(), window.innerWidth / 2))
      return
    }

    if (!scoreRef.current) return

    if (isTotalPointsBroadcast) {
      if (!totalTeamNameRef.current) return
      const teamNameRect = totalTeamNameRef.current.getBoundingClientRect()
      const scoreRect = scoreRef.current.getBoundingClientRect()
      const revealGap = 24
		const teamNameStyle = window.getComputedStyle(totalTeamNameRef.current)
		const teamNameMeasure = document.createElement('canvas').getContext('2d')
		if (!teamNameMeasure) return
		teamNameMeasure.font = `${teamNameStyle.fontWeight} ${teamNameStyle.fontSize} ${teamNameStyle.fontFamily}`
		const textWidth = teamNameMeasure.measureText(totalTeamNameRef.current.textContent ?? '').width
		const teamStartCentre = window.innerWidth / 2 - (scoreRect.width + revealGap) / 2
		const availableWidth = window.innerWidth / 2 - (scoreRect.width * 1.08) / 2 - 42 - (teamStartCentre - teamNameRect.width / 2)
		const fittedScale = Math.min(1, Math.max(0.24, availableWidth / Math.max(1, textWidth)))
		const visibleTeamWidth = textWidth * fittedScale * TOTAL_POINTS_REVEAL_TEAM_SCALE
		const scoreReveal = toRevealRect(scoreRect, teamStartCentre + visibleTeamWidth / 2 + revealGap + scoreRect.width / 2)
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
  }, [broadcastLiveState, displayedFocusId, displayingLiveLeaderboard, focusedMatchupId, isBroadcastRoute, isTotalPointsBroadcast])

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

  if (!authUser) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />
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

  if (authUser.role === 'ADMIN' && (location.pathname === '/league' || location.pathname === '/leagues' || location.pathname === '/leagues/new')) {
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
  const displayLiveState = activeBroadcastEvents.length > 0 ? { ...displayLiveStateBase, events: activeBroadcastEvents } : displayLiveStateBase
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
        onSelectFocus={(focus) => { setShowingLiveLeaderboard(false); setDisplayingLiveLeaderboard(false); setBroadcastFocus(focus) }}
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
