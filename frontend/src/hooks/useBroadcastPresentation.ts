import { useCallback, useEffect, useLayoutEffect, useReducer, useRef } from 'react'
import type {
  BroadcastFocus,
  LiveStandingView,
  LiveStateResponse,
  RevealLayout,
  RevealRect,
} from '../types/live'
import { toRevealRect, toScoreRevealRect, TOTAL_POINTS_REVEAL_TEAM_SCALE } from '../utils/broadcast'

const SCENE_WIPE_MS = 1600
const SCENE_SWAP_MS = SCENE_WIPE_MS / 2
const MATCH_REVEAL_MS = 1900
const TOTAL_SCORE_REVEAL_Y_CORRECTION = 1

const stageTotalPointsState = (
  incomingState: LiveStateResponse | null,
  displayedState: LiveStateResponse | null,
  focusedId: string | null,
) => {
  if (!incomingState || !displayedState || !focusedId) return incomingState
  const incomingTeam = (incomingState.teams ?? []).find((team) => team.managerId === focusedId)
  if (!incomingTeam) return incomingState

  const displayedEventIds = new Set((displayedState.events ?? []).map((event) => event.id))
  const focusedEvents = (incomingState.events ?? []).filter((event) => event.managerId === focusedId)
  const stagedEvents = [
    ...focusedEvents,
    ...(displayedState.events ?? []).filter((event) => (
      !focusedEvents.some((focusedEvent) => focusedEvent.id === event.id)
    )),
  ]
  const remainingEvents = (incomingState.events ?? []).filter((event) => (
    !displayedEventIds.has(event.id) && event.managerId !== focusedId
  ))
  if (remainingEvents.length === 0) return incomingState

  const incomingStanding = (incomingState.standings ?? []).find((standing) => standing.teamId === focusedId)
  const stagedStandings = (displayedState.standings ?? []).map((standing) => (
    standing.teamId === focusedId && incomingStanding ? incomingStanding : standing
  ))

  return {
    ...incomingState,
    teams: (displayedState.teams ?? []).map((team) => (
      team.managerId === focusedId ? incomingTeam : team
    )),
    standings: stagedStandings,
    events: stagedEvents,
  }
}

type PresentationState = {
  liveState: LiveStateResponse | null
  standings: LiveStandingView[] | null
  displayedFocusId: string | null
  transitioningToMatch: boolean
  revealingMatch: boolean
  revealLayout: RevealLayout | null
  visibleEventId: string | null
  holdingPendingUpdates: boolean
  displayingLeaderboard: boolean
  leaderboardRevealLayout: RevealRect | null
}

type PresentationSnapshot = {
  liveState: LiveStateResponse | null
  focusedId: string | null
  eventId: string | null
  showingLeaderboard: boolean
}

type PresentationAction =
  | { type: 'sync'; snapshot: PresentationSnapshot; preserveRevealLayout?: boolean }
  | { type: 'first-focus'; snapshot: PresentationSnapshot }
  | { type: 'start-transition' }
  | { type: 'swap'; snapshot: PresentationSnapshot }
  | { type: 'start-reveal' }
  | { type: 'finish-reveal'; snapshot: PresentationSnapshot }
  | { type: 'finish-transition' }
  | { type: 'set-reveal-layout'; layout: RevealLayout | null }
  | { type: 'set-leaderboard-layout'; layout: RevealRect | null }
  | { type: 'hide-leaderboard' }
  | { type: 'reset' }

const initialPresentationState: PresentationState = {
  liveState: null,
  standings: null,
  displayedFocusId: null,
  transitioningToMatch: false,
  revealingMatch: false,
  revealLayout: null,
  visibleEventId: null,
  holdingPendingUpdates: false,
  displayingLeaderboard: false,
  leaderboardRevealLayout: null,
}

const synchronizedState = (snapshot: PresentationSnapshot): PresentationState => ({
  ...initialPresentationState,
  liveState: snapshot.liveState,
  standings: snapshot.liveState?.standings ?? null,
  displayedFocusId: snapshot.focusedId,
  visibleEventId: snapshot.eventId,
  displayingLeaderboard: snapshot.showingLeaderboard,
})

function presentationReducer(state: PresentationState, action: PresentationAction): PresentationState {
  switch (action.type) {
    case 'sync':
      return {
        ...state,
        liveState: action.snapshot.liveState,
        standings: action.snapshot.liveState?.standings ?? null,
        displayedFocusId: action.snapshot.focusedId,
        transitioningToMatch: false,
        revealingMatch: false,
        revealLayout: action.preserveRevealLayout ? state.revealLayout : null,
        visibleEventId: action.snapshot.eventId,
        holdingPendingUpdates: false,
        displayingLeaderboard: action.snapshot.showingLeaderboard,
      }
    case 'first-focus':
      return {
        ...synchronizedState(action.snapshot),
        visibleEventId: null,
        holdingPendingUpdates: true,
      }
    case 'start-transition':
      return {
        ...state,
        visibleEventId: null,
        holdingPendingUpdates: false,
        transitioningToMatch: true,
        revealingMatch: false,
      }
    case 'swap':
      return {
        ...state,
        liveState: action.snapshot.liveState,
        standings: action.snapshot.liveState?.standings ?? null,
        displayedFocusId: action.snapshot.focusedId,
        displayingLeaderboard: action.snapshot.showingLeaderboard,
        revealLayout: null,
        holdingPendingUpdates: true,
      }
    case 'start-reveal':
      return { ...state, revealingMatch: true }
    case 'finish-reveal':
      return {
        ...state,
        revealingMatch: false,
        visibleEventId: action.snapshot.eventId,
        holdingPendingUpdates: false,
        standings: action.snapshot.liveState?.standings ?? null,
      }
    case 'finish-transition':
      return { ...state, transitioningToMatch: false }
    case 'set-reveal-layout':
      return { ...state, revealLayout: action.layout }
    case 'set-leaderboard-layout':
      return { ...state, leaderboardRevealLayout: action.layout }
    case 'hide-leaderboard':
      return { ...state, displayingLeaderboard: false }
    case 'reset':
      return initialPresentationState
  }
}

type UseBroadcastPresentationOptions = {
  liveState: LiveStateResponse | null
  activeLiveState: LiveStateResponse | null
  hasPendingNotifications: boolean
  focusedId: string | null
  selectedFocus: BroadcastFocus
  latestEventId?: string
  showingLeaderboard: boolean
  isTotalPointsBroadcast: boolean
  isBroadcastRoute: boolean
}

export function useBroadcastPresentation({
  liveState,
  activeLiveState,
  hasPendingNotifications,
  focusedId,
  selectedFocus,
  latestEventId,
  showingLeaderboard,
  isTotalPointsBroadcast,
  isBroadcastRoute,
}: UseBroadcastPresentationOptions) {
  const [presentation, dispatch] = useReducer(presentationReducer, initialPresentationState)
  const previousPresentationFocusRef = useRef<string | null>(null)
  const previousSelectedFocusRef = useRef<BroadcastFocus>('multi')
  const displayedLiveStateRef = useRef<LiveStateResponse | null>(null)
  const transitionTimersRef = useRef<number[]>([])
  const homeHeadingRef = useRef<HTMLHeadingElement>(null)
  const awayHeadingRef = useRef<HTMLHeadingElement>(null)
  const scoreRef = useRef<HTMLElement>(null)
  const totalTeamNameRef = useRef<HTMLSpanElement>(null)
  const totalHeadingRef = useRef<HTMLHeadingElement>(null)
  const leaderboardHeadingRef = useRef<HTMLHeadingElement>(null)
  const presentationFocusId = showingLeaderboard && !isTotalPointsBroadcast
    ? 'live-leaderboard'
    : focusedId
  const isWaitingForQueuedFocus = (
    selectedFocus === 'multi'
    && presentation.liveState !== null
    && hasPendingNotifications
    && activeLiveState === null
  )
  const stateForActiveNotification = activeLiveState ?? liveState

  const clearTransitionTimers = useCallback(() => {
    transitionTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    transitionTimersRef.current = []
  }, [])

  useEffect(() => {
    displayedLiveStateRef.current = presentation.liveState
  }, [presentation.liveState])

  useEffect(() => {
    const snapshotLiveState = isTotalPointsBroadcast
      ? stageTotalPointsState(stateForActiveNotification, displayedLiveStateRef.current, focusedId)
      : stateForActiveNotification
    const snapshot: PresentationSnapshot = {
      liveState: snapshotLiveState,
      focusedId,
      eventId: latestEventId ?? null,
      showingLeaderboard,
    }

    // Keep the current score frozen until the notification queue starts the
    // corresponding focus transition. The server state arrives one render earlier.
    if (isWaitingForQueuedFocus) return

    clearTransitionTimers()
    if (!stateForActiveNotification || !presentationFocusId || !isBroadcastRoute) {
      previousPresentationFocusRef.current = null
      previousSelectedFocusRef.current = selectedFocus
      dispatch({ type: 'sync', snapshot })
      return
    }

    const previousPresentationFocus = previousPresentationFocusRef.current
    const firstBroadcastFocus = previousPresentationFocus === null
    const focusChanged = previousPresentationFocus !== null && previousPresentationFocus !== presentationFocusId
    const userChangedFocus = previousSelectedFocusRef.current !== selectedFocus
    previousPresentationFocusRef.current = presentationFocusId
    previousSelectedFocusRef.current = selectedFocus

    if (userChangedFocus && !firstBroadcastFocus && !isTotalPointsBroadcast) {
      dispatch({ type: 'sync', snapshot })
      return clearTransitionTimers
    }

    if (firstBroadcastFocus) {
      dispatch({ type: 'first-focus', snapshot })
      const revealStartTimer = window.setTimeout(() => dispatch({ type: 'start-reveal' }), 16)
      const revealTimer = window.setTimeout(() => {
        dispatch({ type: 'finish-reveal', snapshot })
      }, MATCH_REVEAL_MS)
      transitionTimersRef.current = [revealStartTimer, revealTimer]
      return clearTransitionTimers
    }

    if (focusChanged) {
      dispatch({ type: 'start-transition' })
      const swapTimer = window.setTimeout(() => dispatch({ type: 'swap', snapshot }), SCENE_SWAP_MS)
      const revealStartTimer = window.setTimeout(
        () => dispatch({ type: 'start-reveal' }),
        SCENE_SWAP_MS + 16,
      )
      const endTimer = window.setTimeout(
        () => dispatch({ type: 'finish-transition' }),
        SCENE_WIPE_MS,
      )
      const revealTimer = window.setTimeout(
        () => dispatch({ type: 'finish-reveal', snapshot }),
        SCENE_SWAP_MS + MATCH_REVEAL_MS,
      )
      transitionTimersRef.current = [swapTimer, revealStartTimer, endTimer, revealTimer]
      return clearTransitionTimers
    }

    dispatch({ type: 'sync', snapshot, preserveRevealLayout: true })
    return clearTransitionTimers
  }, [
    clearTransitionTimers,
    focusedId,
    isBroadcastRoute,
    isTotalPointsBroadcast,
    isWaitingForQueuedFocus,
    latestEventId,
    presentationFocusId,
    selectedFocus,
    showingLeaderboard,
    stateForActiveNotification,
  ])

  useLayoutEffect(() => {
    if (!isBroadcastRoute) return

    if (presentation.displayingLeaderboard) {
      if (!leaderboardHeadingRef.current) return
      dispatch({
        type: 'set-leaderboard-layout',
        layout: toRevealRect(leaderboardHeadingRef.current.getBoundingClientRect(), window.innerWidth / 2),
      })
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
      const availableWidth = (
        window.innerWidth / 2
        - (scoreRect.width * 1.08) / 2
        - 42
        - (teamStartCentre - teamNameRect.width / 2)
      )
      const fittedScale = Math.min(1, Math.max(0.24, availableWidth / Math.max(1, textWidth)))
      const visibleTeamWidth = textWidth * fittedScale * TOTAL_POINTS_REVEAL_TEAM_SCALE
      const scoreReveal = toRevealRect(
        scoreRect,
        teamStartCentre + visibleTeamWidth / 2 + revealGap + scoreRect.width / 2,
      )
      dispatch({
        type: 'set-reveal-layout',
        layout: {
          home: toRevealRect(teamNameRect, window.innerWidth / 2 - (scoreRect.width + revealGap) / 2),
          score: {
            ...scoreReveal,
            top: scoreReveal.top + TOTAL_SCORE_REVEAL_Y_CORRECTION,
            revealY: scoreReveal.revealY - TOTAL_SCORE_REVEAL_Y_CORRECTION,
          },
          away: toRevealRect(teamNameRect, window.innerWidth / 2),
        },
      })
      return
    }

    if (!homeHeadingRef.current || !awayHeadingRef.current) return
    dispatch({
      type: 'set-reveal-layout',
      layout: {
        home: toRevealRect(homeHeadingRef.current.getBoundingClientRect(), window.innerWidth * 0.27),
        score: toScoreRevealRect(scoreRef.current.getBoundingClientRect()),
        away: toRevealRect(awayHeadingRef.current.getBoundingClientRect(), window.innerWidth * 0.73),
      },
    })
  }, [
    focusedId,
    isBroadcastRoute,
    isTotalPointsBroadcast,
    presentation.displayedFocusId,
    presentation.displayingLeaderboard,
    presentation.liveState,
  ])

  const reset = useCallback(() => {
    clearTransitionTimers()
    previousPresentationFocusRef.current = null
    previousSelectedFocusRef.current = 'multi'
    displayedLiveStateRef.current = null
    dispatch({ type: 'reset' })
  }, [clearTransitionTimers])
  const hideDisplayedLeaderboard = useCallback(() => dispatch({ type: 'hide-leaderboard' }), [])

  return {
    ...presentation,
    homeHeadingRef,
    awayHeadingRef,
    scoreRef,
    totalTeamNameRef,
    totalHeadingRef,
    leaderboardHeadingRef,
    reset,
    hideDisplayedLeaderboard,
  }
}
