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
    const poll = async () => {
      if (stopped || denied || document.hidden || active) return
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
          if (!stopped && !denied && !document.hidden) timer = setTimeout(() => void poll(), 10_000)
        }
      }
    }
    const update = () => {
      clearTimeout(timer)
      if (document.hidden) {
        active?.abort()
        active = null
      } else void poll()
    }
    retry.current = () => {
      active?.abort()
      active = null
      denied = false
      void poll()
    }
    void poll()
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      stopped = true
      clearTimeout(timer)
      active?.abort()
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
