import { useCallback, type ReactNode } from 'react'
import { useQuery } from '../../shared/api/useQuery'
import { loadTeamEmblems } from './api'
import { TeamEmblemsContext } from './teamEmblems'

export function TeamEmblemProvider({
  leagueId,
  children,
}: {
  leagueId?: number
  children: ReactNode
}) {
  const load = useCallback(
    (signal: AbortSignal) => (leagueId ? loadTeamEmblems(leagueId, signal) : Promise.resolve([])),
    [leagueId],
  )
  const query = useQuery(`emblems:${leagueId}`, load)
  return (
    <TeamEmblemsContext
      value={{
        teams: query.data ?? [],
        loading: query.status === 'loading',
        error: query.error,
        refresh: query.refresh,
      }}
    >
      {children}
    </TeamEmblemsContext>
  )
}
