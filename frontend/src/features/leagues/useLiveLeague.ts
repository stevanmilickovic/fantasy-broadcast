import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage, HttpError, requestJson } from '../../shared/api/http'

export type LiveLeagueProjection = {
  source: 'DRAFT' | 'CLASSIC'
  gameweek: number
  pointsFetchedAt: string
  fixturesFetchedAt: string
  status: 'UPCOMING' | 'LIVE' | 'PROVISIONAL' | 'FINAL'
  baselineGameweek: number
  managerScores: Record<string, number>
  matchups: Array<{
    id: number
    event: number
    firstManagerId: string
    secondManagerId: string
    firstPoints: number | null
    secondPoints: number | null
    status: string
  }>
  standings: Array<{
    teamId: string
    managerName: string
    teamName: string
    position: number
    total: number
    gameweekPoints: number
    pointsFor: number
  }>
  scoresUnavailableReason: string | null
  standingsUnavailableReason: string | null
}

export function useLiveLeague(leagueId: number, enabled: boolean) {
  const [snapshot, setSnapshot] = useState<{
    leagueId: number
    data?: LiveLeagueProjection
    error?: string
    checkedAt: number
  }>()
  const retry = useRef<() => void>(() => {})
  useEffect(() => {
    if (!enabled) return
    let active: AbortController | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let stopped = false
    let denied = false
    let broadcast = false
    let stream: EventSource | undefined
    const poll = async () => {
      if (stopped || denied || broadcast || document.hidden || active) return
      clearTimeout(timer)
      const controller = new AbortController()
      active = controller
      try {
        const data = await requestJson<LiveLeagueProjection>(
          `/api/customer/leagues/${leagueId}/live`,
          { signal: controller.signal },
        )
        if (!controller.signal.aborted) setSnapshot({ leagueId, data, checkedAt: Date.now() })
      } catch (error) {
        if (!controller.signal.aborted) {
          denied = error instanceof HttpError && [401, 403, 404].includes(error.status)
          if (denied) {
            stream?.close()
            stream = undefined
          }
          setSnapshot((previous) => ({
            leagueId,
            data: denied ? undefined : previous?.leagueId === leagueId ? previous.data : undefined,
            error: errorMessage(error),
            checkedAt: Date.now(),
          }))
        }
      } finally {
        if (active === controller) {
          active = null
          if (!stopped && !denied && !broadcast && !document.hidden)
            timer = setTimeout(() => void poll(), 10_000)
        }
      }
    }
    const connect = () => {
      if (stream || stopped || denied || document.hidden) return
      const events = new EventSource(`/api/customer/leagues/${leagueId}/live/stream`)
      stream = events
      const current = () => !stopped && !document.hidden && stream === events
      events.addEventListener('league-live', (event) => {
        if (!current()) return
        try {
          const data: LiveLeagueProjection = JSON.parse(event.data)
          if (
            !data.gameweek ||
            !data.managerScores ||
            !Array.isArray(data.matchups) ||
            !Array.isArray(data.standings)
          )
            throw new Error('Invalid league update')
          if (data.scoresUnavailableReason) {
            broadcast = false
            void poll()
            return
          }
          broadcast = true
          clearTimeout(timer)
          active?.abort()
          active = null
          setSnapshot({ leagueId, data, checkedAt: Date.now() })
        } catch {
          broadcast = false
          void poll()
        }
      })
      events.addEventListener('broadcast-stopped', () => {
        if (!current()) return
        broadcast = false
        void poll()
      })
      events.addEventListener('broadcast-error', () => {
        if (!current()) return
        setSnapshot((previous) => ({
          leagueId,
          data: previous?.leagueId === leagueId ? previous.data : undefined,
          error: 'FPL update failed. Showing last received values.',
          checkedAt: Date.now(),
        }))
      })
      events.addEventListener('error', () => {
        if (!current()) return
        broadcast = false
        void poll()
      })
    }
    const update = () => {
      clearTimeout(timer)
      if (document.hidden) {
        active?.abort()
        active = null
        stream?.close()
        stream = undefined
        broadcast = false
      } else {
        connect()
        void poll()
      }
    }
    retry.current = () => {
      active?.abort()
      active = null
      denied = false
      broadcast = false
      stream?.close()
      stream = undefined
      connect()
      void poll()
    }
    connect()
    timer = setTimeout(() => void poll(), 200)
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      stopped = true
      clearTimeout(timer)
      active?.abort()
      stream?.close()
      retry.current = () => {}
      window.removeEventListener('focus', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [leagueId, enabled])
  const current = snapshot?.leagueId === leagueId ? snapshot : undefined
  return {
    data: current?.data,
    error: current?.error,
    checkedAt: current?.checkedAt,
    refresh: useCallback(() => retry.current(), []),
  }
}
