import { useEffect, useRef, useReducer } from 'react'
import type { FantasyEventView, LiveStateResponse } from './types'

const NOTIFICATION_DISPLAY_MS = 10_000
const MAX_PENDING_BROADCAST_GROUPS = 3

type BroadcastEventGroup = {
  id: string
  events: FantasyEventView[]
  totalChange: number
  liveState: LiveStateResponse
  revision: number
}

type EventQueue = {
  active: BroadcastEventGroup | null
  pending: BroadcastEventGroup[]
  revision: number
  latestStarted: Pick<BroadcastEventGroup, 'liveState' | 'revision'> | null
}

const eventGroupId = (state: LiveStateResponse, event: FantasyEventView) =>
  state.matchups.find((matchup) =>
    [matchup.home.managerId, matchup.away.managerId].includes(event.managerId),
  )?.id ?? event.managerId

const groupEvents = (
  state: LiveStateResponse,
  events: FantasyEventView[],
  currentGroups: BroadcastEventGroup[],
  revision: number,
) => {
  const groups = new Map(currentGroups.map((group) => [group.id, group]))
  for (const event of events) {
    const id = eventGroupId(state, event)
    const group = groups.get(id) ?? { id, events: [], totalChange: 0, liveState: state }
    groups.set(id, {
      ...group,
      events: [...group.events, event].sort(
        (left, right) => Math.abs(right.pointDelta) - Math.abs(left.pointDelta),
      ),
      totalChange: group.totalChange + Math.abs(event.pointDelta),
      liveState: state,
      revision,
    })
  }

  const visibleGroups = state.voiceNarrationEnabled
    ? [...groups.values()].filter((group) =>
        group.events.some((event) => event.type !== 'AUTO_SUB'),
      )
    : [...groups.values()]
  return visibleGroups
    .sort((left, right) => right.totalChange - left.totalChange)
    .slice(0, MAX_PENDING_BROADCAST_GROUPS)
}

type QueueAction =
  | { type: 'receive'; liveState: LiveStateResponse; events: FantasyEventView[] }
  | { type: 'start' }
  | { type: 'finish' }

function queueReducer(queue: EventQueue, action: QueueAction): EventQueue {
  switch (action.type) {
    case 'receive': {
      const revision = queue.revision + 1
      return {
        ...queue,
        revision,
        pending: groupEvents(action.liveState, action.events, queue.pending, revision),
      }
    }
    case 'start': {
      if (queue.active) return queue
      const [next, ...pending] = queue.pending
      if (!next) return queue
      // Older queued events keep their labels without reverting an already presented score.
      const latestStarted =
        !queue.latestStarted || next.revision > queue.latestStarted.revision
          ? { liveState: next.liveState, revision: next.revision }
          : queue.latestStarted
      return { ...queue, active: { ...next, ...latestStarted }, pending, latestStarted }
    }
    case 'finish':
      return { ...queue, active: null }
  }
}

export function useBroadcastEventQueue(
  liveState: LiveStateResponse | null,
  deferNotificationStart = false,
) {
  const [queue, dispatch] = useReducer(queueReducer, {
    active: null,
    pending: [],
    revision: 0,
    latestStarted: null,
  })
  const receivedEventIdsRef = useRef(new Set<string>())
  useEffect(() => {
    if (!liveState) return
    const events = liveState.events ?? []
    const incomingEvents = events.filter((event) => !receivedEventIdsRef.current.has(event.id))
    incomingEvents.forEach((event) => receivedEventIdsRef.current.add(event.id))
    if (incomingEvents.length === 0) return

    dispatch({ type: 'receive', liveState, events: incomingEvents })
  }, [liveState])

  useEffect(() => {
    if (deferNotificationStart || queue.active || queue.pending.length === 0) return
    dispatch({ type: 'start' })
  }, [deferNotificationStart, queue.active, queue.pending.length])

  useEffect(() => {
    if (!queue.active) return
    const timer = window.setTimeout(() => {
      dispatch({ type: 'finish' })
    }, NOTIFICATION_DISPLAY_MS)
    return () => window.clearTimeout(timer)
  }, [queue.active])

  const activeEvents = queue.active?.events ?? []
  const latestEvent = activeEvents[0]
  return {
    activeEvents,
    activeLiveState: queue.active?.liveState ?? null,
    hasPendingNotifications: queue.pending.length > 0,
    latestEvent,
  }
}
