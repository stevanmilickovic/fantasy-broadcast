import { useCallback, useEffect, useReducer, useRef } from 'react'
import { findFocusedMatchup } from './broadcast'
import type { BroadcastFocus, FantasyEventView, LiveStateResponse } from './types'

const INACTIVITY_ROTATION_MS = 60_000
const IDLE_TRANSITIONS_BEFORE_LEADERBOARD = 4
const COMPREHENSIVE_MOCK_ROTATION_MS = 4_000
const COMPREHENSIVE_MOCK_TRANSITIONS_BEFORE_LEADERBOARD = 1

type RotationState = {
  rotatedFocusId: string | null
  showingLeaderboard: boolean
}

type RotationAction =
  | { type: 'backend-event'; focusId?: string }
  | { type: 'show-leaderboard' }
  | { type: 'show-focus'; focusId: string }
  | { type: 'dismiss-leaderboard' }

const initialRotationState: RotationState = {
  rotatedFocusId: null,
  showingLeaderboard: false,
}

function rotationReducer(state: RotationState, action: RotationAction): RotationState {
  switch (action.type) {
    case 'backend-event':
      return {
        rotatedFocusId: action.focusId ?? state.rotatedFocusId,
        showingLeaderboard: false,
      }
    case 'dismiss-leaderboard':
      return state.showingLeaderboard ? { ...state, showingLeaderboard: false } : state
    case 'show-leaderboard':
      return { ...state, showingLeaderboard: true }
    case 'show-focus':
      return { rotatedFocusId: action.focusId, showingLeaderboard: false }
  }
}

type UseBroadcastFocusOptions = {
  liveState: LiveStateResponse | null
  latestEvent?: FantasyEventView
  selectedFocus: BroadcastFocus
}

export function useBroadcastFocus({
  liveState,
  latestEvent,
  selectedFocus,
}: UseBroadcastFocusOptions) {
  const [rotation, dispatch] = useReducer(rotationReducer, initialRotationState)
  const lastBackendEventAtRef = useRef<number | null>(null)
  const idleTransitionCountRef = useRef(0)
  const recentlyShownFocusesRef = useRef(new Map<string, number>())
  const latestLiveStateRef = useRef<LiveStateResponse | null>(null)
  const matchups = liveState?.matchups ?? []
  const teams = liveState?.teams ?? []

  const eventTargetMatchup = latestEvent
    ? findFocusedMatchup(liveState ? { ...liveState, events: [latestEvent] } : null)
    : undefined
  const eventTargetTeam = latestEvent
    ? teams.find((team) => team.managerId === latestEvent.managerId)
    : undefined
  const isTotalPointsBroadcast = matchups.length === 0 && teams.length > 0
  const isComprehensiveMock = liveState?.status.mode === 'COMPREHENSIVE MOCK'
  const inactivityRotationMs = isComprehensiveMock
    ? COMPREHENSIVE_MOCK_ROTATION_MS
    : INACTIVITY_ROTATION_MS
  const idleTransitionsBeforeLeaderboard = isComprehensiveMock
    ? COMPREHENSIVE_MOCK_TRANSITIONS_BEFORE_LEADERBOARD
    : IDLE_TRANSITIONS_BEFORE_LEADERBOARD
  const eventFocusId = isTotalPointsBroadcast ? eventTargetTeam?.managerId : eventTargetMatchup?.id
  const automaticFocusId = eventFocusId ?? rotation.rotatedFocusId
  const automaticMatchup = automaticFocusId
    ? matchups.find((matchup) => matchup.id === automaticFocusId)
    : matchups[0]
  const automaticTeam = automaticFocusId
    ? teams.find((team) => team.managerId === automaticFocusId)
    : teams[0]
  const selectedMatchup =
    selectedFocus === 'multi' ? undefined : matchups.find((matchup) => matchup.id === selectedFocus)
  const selectedTeam =
    selectedFocus === 'multi' ? undefined : teams.find((team) => team.managerId === selectedFocus)
  const targetMatchup = selectedMatchup ?? eventTargetMatchup ?? automaticMatchup ?? matchups[0]
  const targetTeam = selectedTeam ?? eventTargetTeam ?? automaticTeam ?? teams[0]
  const focusedId = isTotalPointsBroadcast
    ? (targetTeam?.managerId ?? null)
    : (targetMatchup?.id ?? null)

  useEffect(() => {
    latestLiveStateRef.current = liveState
  }, [liveState])

  useEffect(() => {
    if (!focusedId) return
    recentlyShownFocusesRef.current.set(focusedId, Date.now())
  }, [focusedId])

  useEffect(() => {
    if (!latestEvent) return
    lastBackendEventAtRef.current = Date.now()
    idleTransitionCountRef.current = 0
    dispatch({ type: 'backend-event', focusId: eventFocusId })
  }, [eventFocusId, latestEvent])

  useEffect(() => {
    if (selectedFocus !== 'multi' || !focusedId) return
    const lastActivityAt = lastBackendEventAtRef.current ?? Date.now()
    lastBackendEventAtRef.current = lastActivityAt
    const delay = Math.max(0, inactivityRotationMs - (Date.now() - lastActivityAt))

    const timer = window.setTimeout(() => {
      const state = latestLiveStateRef.current
      if (!state) return
      const candidates = isTotalPointsBroadcast
        ? (state.teams ?? []).map((team) => team.managerId)
        : (state.matchups ?? []).map((matchup) => matchup.id)
      if (candidates.length < 2) return

      if (
        !rotation.showingLeaderboard &&
        idleTransitionCountRef.current >= idleTransitionsBeforeLeaderboard
      ) {
        idleTransitionCountRef.current = 0
        lastBackendEventAtRef.current = Date.now()
        dispatch({ type: 'show-leaderboard' })
        return
      }

      const nextFocusId = candidates
        .filter((candidate) => candidate !== focusedId)
        .sort(
          (left, right) =>
            (recentlyShownFocusesRef.current.get(left) ?? 0) -
            (recentlyShownFocusesRef.current.get(right) ?? 0),
        )[0]
      if (!nextFocusId) return

      lastBackendEventAtRef.current = Date.now()
      recentlyShownFocusesRef.current.set(nextFocusId, Date.now())
      idleTransitionCountRef.current += 1
      dispatch({ type: 'show-focus', focusId: nextFocusId })
    }, delay)

    return () => window.clearTimeout(timer)
  }, [
    focusedId,
    isTotalPointsBroadcast,
    latestEvent?.id,
    inactivityRotationMs,
    idleTransitionsBeforeLeaderboard,
    rotation.showingLeaderboard,
    selectedFocus,
  ])

  const dismissLeaderboard = useCallback(() => dispatch({ type: 'dismiss-leaderboard' }), [])

  return {
    targetMatchup,
    targetTeam,
    focusedId,
    isTotalPointsBroadcast,
    showingLeaderboard: rotation.showingLeaderboard,
    dismissLeaderboard,
  }
}
