import { useEffect, useReducer } from 'react'
import type { FantasyEventView } from './types'

const NOTIFICATION_DELAY_MS = 240
const NOTIFICATION_EXIT_MS = 200
const POINT_COUNT_MS = 360
const MIN_POINT_STEP_MS = 70

type NotificationState = {
  eventKey: string
  points: number
  displayedPoints: number
  events: FantasyEventView[]
  phase: 'idle' | 'waiting' | 'counting' | 'leaving'
}

type NotificationAction =
  | { type: 'receive'; eventKey: string; points: number; events: FantasyEventView[] }
  | { type: 'show' }
  | { type: 'tick' }
  | { type: 'remove' }

function receiveNotification(
  input: Extract<NotificationAction, { type: 'receive' }>,
  previousEvents: FantasyEventView[] = [],
): NotificationState {
  const delta = input.events.reduce((total, event) => total + event.pointDelta, 0)
  return {
    eventKey: input.eventKey,
    points: input.points,
    displayedPoints: input.points - delta,
    events: input.events.length ? input.events : previousEvents,
    phase: input.events.length ? 'waiting' : previousEvents.length ? 'leaving' : 'idle',
  }
}

function notificationReducer(
  state: NotificationState,
  action: NotificationAction,
): NotificationState {
  switch (action.type) {
    case 'receive':
      return receiveNotification(action, state.events)
    case 'show':
      return { ...state, phase: 'counting' }
    case 'tick':
      return {
        ...state,
        displayedPoints: state.displayedPoints + Math.sign(state.points - state.displayedPoints),
      }
    case 'remove':
      return { ...state, phase: 'idle', events: [], displayedPoints: state.points }
  }
}

export function usePlayerNotification(
  points: number,
  events: FantasyEventView[],
  pendingPointDelta: number,
) {
  const eventKey = events.map((event) => `${event.id}:${event.pointDelta}`).join('|')
  const [state, dispatch] = useReducer(
    notificationReducer,
    { type: 'receive', points, events, eventKey },
    receiveNotification,
  )
  // A new event establishes its starting score before painting, including when
  // a mounted player is reused for another scene. Timers only advance that state.
  if (state.eventKey !== eventKey || state.points !== points) {
    dispatch({ type: 'receive', points, events, eventKey })
  }
  const delta = state.events.reduce((total, event) => total + event.pointDelta, 0)
  useEffect(() => {
    if (state.phase === 'idle') return
    if (state.phase === 'counting' && state.displayedPoints === state.points) return
    const delay =
      state.phase === 'waiting'
        ? NOTIFICATION_DELAY_MS
        : state.phase === 'leaving'
          ? NOTIFICATION_EXIT_MS
          : Math.max(MIN_POINT_STEP_MS, Math.round(POINT_COUNT_MS / Math.max(1, Math.abs(delta))))
    const type = state.phase === 'waiting' ? 'show' : state.phase === 'leaving' ? 'remove' : 'tick'
    const timer = window.setTimeout(() => dispatch({ type }), delay)
    return () => window.clearTimeout(timer)
  }, [delta, state.phase, state.eventKey, state.displayedPoints, state.points])

  return {
    activeEvents: state.events,
    activeEvent: state.events[0],
    notificationEventId:
      state.phase === 'counting' || state.phase === 'leaving'
        ? (state.events[0]?.id ?? null)
        : null,
    notificationLeaving: state.phase === 'leaving',
    pointsToRender:
      events.length === 0 && pendingPointDelta !== 0
        ? points - pendingPointDelta
        : state.displayedPoints,
  }
}
