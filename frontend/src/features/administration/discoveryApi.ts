import { request } from '../../shared/api/http'
import type {
  FplElementStatusRaw,
  FplLeagueDetailsRaw,
  FplPlayer,
  LeagueDiscoveryState,
} from '../../shared/fpl/types'

export const loadLeagueDiscovery = async (
  leagueId: string,
  signal?: AbortSignal,
): Promise<LeagueDiscoveryState> => {
  const [detailsResponse, elementStatusResponse, playersResponse] = await Promise.all([
    request(`/api/fpl/discovery/league/${leagueId}/raw`, { signal }),
    request(`/api/fpl/discovery/league/${leagueId}/element-status/raw`, { signal }),
    request('/api/fpl/discovery/players?limit=1000', { signal }),
  ])

  return {
    details: (await detailsResponse.json()) as FplLeagueDetailsRaw,
    elementStatus: (await elementStatusResponse.json()) as FplElementStatusRaw,
    players: (await playersResponse.json()) as FplPlayer[],
  }
}

export const loadMockLeagueDiscovery = async (
  signal?: AbortSignal,
): Promise<LeagueDiscoveryState> => {
  const response = await request('/api/fpl/mock/start', { signal })
  return response.json()
}
