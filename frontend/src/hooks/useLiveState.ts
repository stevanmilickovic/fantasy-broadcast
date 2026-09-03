import { useCallback, useEffect, useState } from 'react'
import { loadLiveState } from '../api/liveApi'
import type { LiveStateResponse } from '../types/live'

type LiveStateSnapshot = {
  sourceKey: string
  state: LiveStateResponse
}

type UseLiveStateOptions = {
  enabled: boolean
  leagueId?: number
}

const sourceKeyFor = (leagueId: number | undefined) => leagueId === undefined ? 'global' : `league-${leagueId}`

export function useLiveState({ enabled, leagueId }: UseLiveStateOptions) {
  const sourceKey = sourceKeyFor(leagueId)
  const [snapshot, setSnapshot] = useState<LiveStateSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const liveState = enabled && snapshot?.sourceKey === sourceKey ? snapshot.state : null

  const updateLiveState = useCallback((state: LiveStateResponse) => {
    setSnapshot({ sourceKey, state })
  }, [sourceKey])

  useEffect(() => {
    if (!enabled) return

    const controller = new AbortController()
    loadLiveState(leagueId, controller.signal)
      .then((state) => {
        setSnapshot({ sourceKey, state })
        setError(null)
      })
      .catch((requestError: Error) => {
        if (requestError.name !== 'AbortError') setError(requestError.message)
      })

    return () => controller.abort()
  }, [enabled, leagueId, sourceKey])

  useEffect(() => {
    if (!enabled) return

    const parameters = new URLSearchParams()
    if (leagueId !== undefined) parameters.set('leagueId', String(leagueId))
    const query = parameters.size > 0 ? `?${parameters}` : ''
    const events = new EventSource(`/api/live-state/stream${query}`)

    events.addEventListener('live-state', (event) => {
      setSnapshot({ sourceKey, state: JSON.parse(event.data) as LiveStateResponse })
      setError(null)
    })

    return () => events.close()
  }, [enabled, leagueId, sourceKey])

  return {
    liveState,
    error,
    setLiveState: updateLiveState,
    setError,
  }
}
