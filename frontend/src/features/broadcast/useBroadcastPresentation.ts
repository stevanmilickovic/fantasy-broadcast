import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import { initialPresentationState, presentationReducer } from './broadcastPlayback'
import type { BroadcastFocus, FantasyEventView, LiveStateResponse } from './types'

type Options = {
  selectionRevision?: number
  liveState: LiveStateResponse | null
  activeLiveState: LiveStateResponse | null
  activeEvents?: FantasyEventView[]
  hasPendingNotifications: boolean
  focusedId: string | null
  selectedFocus: BroadcastFocus
  latestEventId?: string
  showingLeaderboard: boolean
  onTransitionStateChange: (transitioning: boolean) => void
}
export function useBroadcastPresentation(options: Options) {
  const {
    liveState,
    activeLiveState,
    activeEvents,
    hasPendingNotifications,
    focusedId,
    selectedFocus,
    latestEventId,
    showingLeaderboard,
    onTransitionStateChange,
    selectionRevision = 0,
  } = options
  const notificationState = useMemo(
    () =>
      activeLiveState && activeEvents
        ? { ...activeLiveState, events: activeEvents }
        : activeLiveState,
    [activeLiveState, activeEvents],
  )
  const idleState = useMemo(() => (liveState ? { ...liveState, events: [] } : null), [liveState])
  const [state, dispatch] = useReducer(presentationReducer, initialPresentationState)
  const previousSelection = useRef(`${selectedFocus}:${selectionRevision}`)
  useEffect(() => {
    const manual = previousSelection.current !== `${selectedFocus}:${selectionRevision}`
    previousSelection.current = `${selectedFocus}:${selectionRevision}`
    // A stream render can precede queue activation. Do not expose its newer score.
    if (!manual && state.snapshot.liveState && hasPendingNotifications && !activeLiveState) return
    dispatch({
      type: 'receive',
      manual,
      snapshot: {
        liveState: notificationState ?? (state.snapshot.liveState ? idleState : liveState),
        focusedId,
        eventId: latestEventId ?? null,
        showingLeaderboard,
      },
    })
  }, [
    liveState,
    activeLiveState,
    notificationState,
    idleState,
    hasPendingNotifications,
    focusedId,
    selectedFocus,
    latestEventId,
    showingLeaderboard,
    selectionRevision,
    state.phase,
    state.snapshot.liveState,
  ])
  useEffect(
    () => onTransitionStateChange(state.phase !== 'idle'),
    [state.phase, onTransitionStateChange],
  )
  const covered = useCallback((id: number) => dispatch({ type: 'covered', id }), [])
  const settled = useCallback((id: number) => dispatch({ type: 'settled', id }), [])
  return {
    liveState: state.snapshot.liveState,
    standings: state.snapshot.liveState?.standings ?? [],
    displayedFocusId: state.snapshot.focusedId,
    visibleEventId: state.phase === 'idle' ? state.snapshot.eventId : null,
    holdingPendingUpdates: state.phase === 'preparing',
    displayingLeaderboard: state.snapshot.showingLeaderboard,
    phase: state.phase,
    transitionId: state.transitionId,
    revealIndex: state.revealIndex,
    covered,
    settled,
  }
}
