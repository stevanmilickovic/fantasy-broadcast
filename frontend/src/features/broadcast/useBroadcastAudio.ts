import { useEffect, useRef } from 'react'
import { playNarrationAudio, playPointChangeSound } from './broadcastSound'
import type { LiveStateResponse } from './types'

export function useBroadcastAudio(
  state: LiveStateResponse | null,
  visibleEventId: string | null,
  focusId?: string | null,
) {
  const sounded = useRef(new Set<string>())
  const narrated = useRef(new Set<string>())
  const controller = useRef<AbortController | null>(null)
  useEffect(() => {
    const current = new AbortController()
    const narrationIds = narrated.current
    controller.current = current
    return () => {
      current.abort()
      narrationIds.clear()
    }
  }, [])
  useEffect(() => {
    const event = state?.events.find((candidate) => candidate.id === visibleEventId)
    if (!event || sounded.current.has(event.id)) return
    if (focusId === null) return
    if (
      focusId !== undefined &&
      event.managerId !== focusId &&
      !state?.matchups.some(
        (match) =>
          match.id === focusId &&
          [match.home.managerId, match.away.managerId].includes(event.managerId),
      )
    )
      return
    sounded.current.add(event.id)
    if (document.visibilityState !== 'hidden') playPointChangeSound(event.pointDelta)
  }, [state, visibleEventId, focusId])
  const narration = state?.commentary[0]
  useEffect(() => {
    if (!narration?.audioUrl || narrated.current.has(narration.id)) return
    narrated.current.add(narration.id)
    if (document.visibilityState === 'hidden') return
    void playNarrationAudio(narration.audioUrl, controller.current?.signal)
  }, [narration])
}
