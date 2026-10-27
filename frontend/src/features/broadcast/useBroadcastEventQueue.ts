import { useCallback, useEffect, useRef, useState } from 'react'
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

export function useBroadcastEventQueue(
  liveState: LiveStateResponse | null,
  deferNotificationStart = false,
) {
  const [queue, setQueue] = useState<EventQueue>({ active: null, pending: [] })
  const receivedEventIdsRef = useRef(new Set<string>())
  const lastSoundedEventIdRef = useRef<string | null>(null)
  const lastNarrationAudioIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!liveState) return
    const events = liveState.events ?? []
    const incomingEvents = events.filter((event) => !receivedEventIdsRef.current.has(event.id))
    incomingEvents.forEach((event) => receivedEventIdsRef.current.add(event.id))
    if (incomingEvents.length === 0) return

    setQueue((current) => {
      return {
        ...current,
        pending: groupEvents(liveState, incomingEvents, current.pending),
      }
    })
  }, [liveState])

  useEffect(() => {
    if (deferNotificationStart || queue.active || queue.pending.length === 0) return
    setQueue((current) => {
      const [active, ...pending] = current.pending
      return { active: active ?? null, pending }
    })
  }, [deferNotificationStart, queue.active, queue.pending.length])

  useEffect(() => {
    if (!queue.active) return
    const timer = window.setTimeout(() => {
      setQueue((current) => ({ ...current, active: null }))
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
    void playNarrationAudio(latestNarration.audioUrl)
  }, [latestNarration])

  const reset = useCallback(() => {
    receivedEventIdsRef.current.clear()
    lastSoundedEventIdRef.current = null
    lastNarrationAudioIdRef.current = null
    setQueue({ active: null, pending: [] })
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
