import { useCallback, useEffect, useRef, useReducer } from 'react'
import { playNarrationAudio, playPointChangeSound } from './broadcastSound'
import type { FantasyEventView, LiveStateResponse } from './types'

const NOTIFICATION_DISPLAY_MS = 10_000
const MAX_PENDING_BROADCAST_GROUPS = 3

type BroadcastEventGroup = {
  id: string
  events: FantasyEventView[]
  totalChange: number
  liveState: LiveStateResponse
}

type EventQueue = {
  active: BroadcastEventGroup | null
  pending: BroadcastEventGroup[]
}

const eventGroupId = (state: LiveStateResponse, event: FantasyEventView) =>
  state.matchups.find((matchup) =>
    [matchup.home.managerId, matchup.away.managerId].includes(event.managerId),
  )?.id ?? event.managerId

const groupEvents = (
  state: LiveStateResponse,
  events: FantasyEventView[],
  currentGroups: BroadcastEventGroup[] = [],
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
  | { type: 'reset' }

function queueReducer(queue: EventQueue, action: QueueAction): EventQueue {
  switch (action.type) {
    case 'receive':
      return { ...queue, pending: groupEvents(action.liveState, action.events, queue.pending) }
    case 'start': {
      if (queue.active) return queue
      const [active, ...pending] = queue.pending
      return { active: active ?? null, pending }
    }
    case 'finish':
      return { ...queue, active: null }
    case 'reset':
      return { active: null, pending: [] }
  }
}

export function useBroadcastEventQueue(
  liveState: LiveStateResponse | null,
  deferNotificationStart = false,
) {
  const [queue, dispatch] = useReducer(queueReducer, { active: null, pending: [] })
  const receivedEventIdsRef = useRef(new Set<string>())
  const lastSoundedEventIdRef = useRef<string | null>(null)
  const narrationControllerRef = useRef<AbortController | null>(null)
  const lastNarrationAudioIdRef = useRef<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    narrationControllerRef.current = controller
    return () => controller.abort()
  }, [])

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
  useEffect(() => {
    if (!latestEvent || latestEvent.id === lastSoundedEventIdRef.current) return
    lastSoundedEventIdRef.current = latestEvent.id
    playPointChangeSound(latestEvent.pointDelta)
  }, [latestEvent])

  const latestNarration = liveState?.commentary?.[0]
  useEffect(() => {
    if (!latestNarration?.audioUrl || latestNarration.id === lastNarrationAudioIdRef.current) return
    lastNarrationAudioIdRef.current = latestNarration.id
    void playNarrationAudio(latestNarration.audioUrl, narrationControllerRef.current?.signal)
  }, [latestNarration])

  const reset = useCallback(() => {
    receivedEventIdsRef.current.clear()
    lastSoundedEventIdRef.current = null
    lastNarrationAudioIdRef.current = null
    dispatch({ type: 'reset' })
  }, [])

  return {
    activeEvents,
    activeFocusId: queue.active?.id,
    activeLiveState: queue.active?.liveState ?? null,
    hasPendingNotifications: queue.pending.length > 0,
    latestEvent,
    reset,
  }
}
