import { useCallback, useEffect } from 'react'
import { useQuery } from '../../shared/api/useQuery'
import { loadLeagueRequests } from './api'

export function useLeagueRequests(leagueId: number, enabled = true) {
  const load = useCallback(
    (signal: AbortSignal) => (enabled ? loadLeagueRequests(leagueId, signal) : Promise.resolve([])),
    [leagueId, enabled],
  )
  const query = useQuery(`league-requests:${leagueId}:${enabled}`, load)
  const { refresh } = query
  useEffect(() => {
    if (!enabled) return
    const update = () => {
      if (!document.hidden) refresh()
    }
    const timer = setInterval(update, 30_000)
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [enabled, refresh])
  return query
}
