import { useCallback, useEffect, useReducer, useRef } from 'react'
import {
  initialPresentationState,
  presentationReducer,
  stageTotalPointsState,
  type PresentationSnapshot,
} from './broadcastPlayback'
import { useBroadcastMeasurement } from './useBroadcastMeasurement'
import type { BroadcastFocus, LiveStateResponse } from './types'

const SCENE_WIPE_MS = 1600
const SCENE_SWAP_MS = SCENE_WIPE_MS / 2
const MATCH_REVEAL_MS = 1900

type UseBroadcastPresentationOptions = {
  liveState: LiveStateResponse | null
  activeLiveState: LiveStateResponse | null
  hasPendingNotifications: boolean
  focusedId: string | null
  selectedFocus: BroadcastFocus
  latestEventId?: string
  showingLeaderboard: boolean
  isTotalPointsBroadcast: boolean
  onTransitionStateChange: (transitioning: boolean) => void
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
  onTransitionStateChange,
}: UseBroadcastPresentationOptions) {
  const [presentation, dispatch] = useReducer(presentationReducer, initialPresentationState)
  const previousPresentationFocusRef = useRef<string | null>(null)
  const previousSelectedFocusRef = useRef<BroadcastFocus>('multi')
  const displayedLiveStateRef = useRef<LiveStateResponse | null>(null)
  const transitionTimersRef = useRef<number[]>([])
  const transitionInProgressRef = useRef(false)
  const presentationFocusId = showingLeaderboard ? 'live-leaderboard' : focusedId
  const isWaitingForQueuedFocus =
    selectedFocus === 'multi' &&
    presentation.liveState !== null &&
    hasPendingNotifications &&
    activeLiveState === null
  const stateForActiveNotification = activeLiveState ?? liveState

  useEffect(() => {
    onTransitionStateChange(presentation.transitioningToMatch || presentation.revealingMatch)
  }, [onTransitionStateChange, presentation.revealingMatch, presentation.transitioningToMatch])

  const clearTransitionTimers = useCallback(() => {
    transitionTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    transitionTimersRef.current = []
    transitionInProgressRef.current = false
  }, [])

  useEffect(() => clearTransitionTimers, [clearTransitionTimers])

  useEffect(() => {
    displayedLiveStateRef.current = presentation.liveState
  }, [presentation.liveState])

  useEffect(() => {
    const snapshotLiveState = isTotalPointsBroadcast
      ? stageTotalPointsState(
          stateForActiveNotification,
          displayedLiveStateRef.current,
          focusedId,
          presentation.displayedFocusId,
          activeLiveState !== null,
        )
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
    if (transitionInProgressRef.current) return

    clearTransitionTimers()
    if (!stateForActiveNotification || !presentationFocusId) {
      previousPresentationFocusRef.current = null
      previousSelectedFocusRef.current = selectedFocus
      dispatch({ type: 'sync', snapshot })
      return
    }

    const previousPresentationFocus = previousPresentationFocusRef.current
    const firstBroadcastFocus = previousPresentationFocus === null
    const focusChanged =
      previousPresentationFocus !== null && previousPresentationFocus !== presentationFocusId
    const userChangedFocus = previousSelectedFocusRef.current !== selectedFocus
    previousPresentationFocusRef.current = presentationFocusId
    previousSelectedFocusRef.current = selectedFocus

    if (userChangedFocus && !firstBroadcastFocus && !isTotalPointsBroadcast) {
      dispatch({ type: 'sync', snapshot })
      return clearTransitionTimers
    }

    if (firstBroadcastFocus) {
      transitionInProgressRef.current = true
      dispatch({ type: 'first-focus', snapshot })
      const revealStartTimer = window.setTimeout(() => dispatch({ type: 'start-reveal' }), 16)
      const revealTimer = window.setTimeout(() => {
        dispatch({ type: 'finish-reveal', snapshot })
        transitionInProgressRef.current = false
      }, MATCH_REVEAL_MS)
      transitionTimersRef.current = [revealStartTimer, revealTimer]
      return
    }

    if (focusChanged) {
      transitionInProgressRef.current = true
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
      const revealTimer = window.setTimeout(() => {
        dispatch({ type: 'finish-reveal', snapshot })
        transitionInProgressRef.current = false
      }, SCENE_SWAP_MS + MATCH_REVEAL_MS)
      transitionTimersRef.current = [swapTimer, revealStartTimer, endTimer, revealTimer]
      return
    }

    dispatch({ type: 'sync', snapshot })
    return clearTransitionTimers
  }, [
    activeLiveState,
    clearTransitionTimers,
    focusedId,
    isTotalPointsBroadcast,
    isWaitingForQueuedFocus,
    latestEventId,
    presentationFocusId,
    presentation.displayedFocusId,
    presentation.revealingMatch,
    presentation.transitioningToMatch,
    selectedFocus,
    showingLeaderboard,
    stateForActiveNotification,
  ])

  const hideDisplayedLeaderboard = useCallback(() => dispatch({ type: 'hide-leaderboard' }), [])

  const measurement = useBroadcastMeasurement({
    liveState: presentation.liveState,
    displayedFocusId: presentation.displayedFocusId,
    displayingLeaderboard: presentation.displayingLeaderboard,
    isTotalPointsBroadcast,
  })

  return {
    ...presentation,
    ...measurement,
    hideDisplayedLeaderboard,
  }
}
