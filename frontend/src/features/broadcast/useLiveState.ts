import { useCallback, useEffect, useState } from 'react'
import { loadLiveState } from './api'
import type { LiveStateResponse } from './types'

type LiveStateSnapshot = {
  sourceKey: string
  state: LiveStateResponse
}

type UseLiveStateOptions = {
  enabled: boolean
  leagueId?: number
}

const sourceKeyFor = (leagueId: number | undefined) =>
  leagueId === undefined ? 'global' : `league-${leagueId}`

const normalizeLiveState = (state: LiveStateResponse): LiveStateResponse => ({
  ...state,
  matchups: state.matchups ?? [],
  teams: state.teams ?? [],
  standings: state.standings ?? [],
  events: state.events ?? [],
  commentary: state.commentary ?? [],
})

export function useLiveState({ enabled, leagueId }: UseLiveStateOptions) {
  const [revision, setRevision] = useState(0)
  const retry = useCallback(() => setRevision((value) => value + 1), [])
  const sourceKey = sourceKeyFor(leagueId)
  const [snapshot, setSnapshot] = useState<LiveStateSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const liveState = enabled && snapshot?.sourceKey === sourceKey ? snapshot.state : null

  const updateLiveState = useCallback(
    (state: LiveStateResponse) => {
      setSnapshot({ sourceKey, state: normalizeLiveState(state) })
    },
    [sourceKey],
  )

  useEffect(() => {
    if (!enabled) return

    const controller = new AbortController()
    let receivedStreamState = false
    loadLiveState(leagueId, controller.signal)
      .then((state) => {
        if (controller.signal.aborted || receivedStreamState) return
        setSnapshot({ sourceKey, state: normalizeLiveState(state) })
        setError(null)
      })
      .catch((requestError: Error) => {
        if (!controller.signal.aborted && !receivedStreamState) setError(requestError.message)
      })

    const parameters = new URLSearchParams()
    if (leagueId !== undefined) parameters.set('leagueId', String(leagueId))
    const query = parameters.size > 0 ? `?${parameters}` : ''
    const events = new EventSource(`/api/live-state/stream${query}`)

    events.addEventListener('live-state', (event) => {
      if (controller.signal.aborted) return
      try {
        const state: LiveStateResponse = JSON.parse(event.data)
        if (!state || !state.status || !state.sequence) throw new Error('Invalid broadcast update')
        receivedStreamState = true
        setSnapshot({ sourceKey, state: normalizeLiveState(state) })
        setError(null)
      } catch {
        setError('Unable to read the broadcast update. Waiting for the next update.')
      }
    })
    events.addEventListener('error', () => {
      if (!controller.signal.aborted) setError('Broadcast connection interrupted. Reconnecting…')
    })
    return () => {
      controller.abort()
      events.close()
    }
  }, [enabled, leagueId, sourceKey, revision])

  return {
    liveState,
    error,
    retry,
    setLiveState: updateLiveState,
    setError,
  }
}
