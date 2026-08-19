import type { FplElementStatusRaw, FplLeagueDetailsRaw, FplPlayer, LeagueDiscoveryState } from '../types/fpl'

export const loadLeagueDiscovery = async (leagueId: string): Promise<LeagueDiscoveryState> => {
  const [detailsResponse, elementStatusResponse, playersResponse] = await Promise.all([
    fetch(`/api/fpl/discovery/league/${leagueId}/raw`),
    fetch(`/api/fpl/discovery/league/${leagueId}/element-status/raw`),
    fetch('/api/fpl/discovery/players?limit=1000'),
  ])

  if (!detailsResponse.ok) {
    throw new Error(`League request failed with ${detailsResponse.status}`)
  }
  if (!elementStatusResponse.ok) {
    throw new Error(`Element status request failed with ${elementStatusResponse.status}`)
  }
  if (!playersResponse.ok) {
    throw new Error(`Players request failed with ${playersResponse.status}`)
  }

  return {
    details: (await detailsResponse.json()) as FplLeagueDetailsRaw,
    elementStatus: (await elementStatusResponse.json()) as FplElementStatusRaw,
    players: (await playersResponse.json()) as FplPlayer[],
  }
}

export const loadMockLeagueDiscovery = async (): Promise<LeagueDiscoveryState> => {
  const response = await fetch('/api/fpl/mock/start')
  if (!response.ok) {
    throw new Error(`Mock league request failed with ${response.status}`)
  }
  return response.json()
}
