import { request } from '../../shared/api/http'
import type {
  ClassicLeagueDiscovery,
  DraftLeagueDiscovery,
  FplLeagueType,
} from '../../shared/fpl/types'
import type { BroadcastSchedule } from '../administration/types'
import type { LiveStateResponse } from '../broadcast/types'
import type { LeagueRegistrationAccess, RegisteredLeague } from './types'
export const loadRegisteredLeagues = async (signal?: AbortSignal): Promise<RegisteredLeague[]> =>
  (await request('/api/customer/leagues', { signal })).json()

export const loadLeagueRegistrationAccess = async (
  signal?: AbortSignal,
): Promise<LeagueRegistrationAccess> =>
  (await request('/api/customer/league-registration', { signal })).json()

export const searchRegisteredLeagues = async (
  query: string,
  signal?: AbortSignal,
): Promise<RegisteredLeague[]> =>
  (
    await request(`/api/customer/leagues/search?${new URLSearchParams({ query })}`, { signal })
  ).json()

export const followLeague = async (leagueId: number): Promise<RegisteredLeague> =>
  (await request(`/api/customer/leagues/${leagueId}/follow`, { method: 'POST' })).json()

export const deleteOwnedLeague = async (leagueId: number) => {
  await request(`/api/customer/leagues/${leagueId}`, { method: 'DELETE' })
}

export const registerLeague = async (
  fplLeagueId: string,
  leagueType: FplLeagueType,
): Promise<RegisteredLeague> =>
  (
    await request('/api/customer/leagues', {
      method: 'POST',
      body: JSON.stringify({ fplLeagueId: Number(fplLeagueId), leagueType }),
    })
  ).json()

export const loadClassicLeagueOverview = async (
  leagueId: number,
  signal?: AbortSignal,
): Promise<ClassicLeagueDiscovery> =>
  (await request(`/api/customer/leagues/${leagueId}/overview`, { signal })).json()

export const loadDraftLeagueOverview = async (
  leagueId: number,
  signal?: AbortSignal,
): Promise<DraftLeagueDiscovery> =>
  (await request(`/api/customer/leagues/${leagueId}/draft-overview`, { signal })).json()

export const loadActiveBroadcastSchedules = async (
  signal?: AbortSignal,
): Promise<BroadcastSchedule[]> =>
  (await request('/api/customer/broadcast-schedules/active', { signal })).json()

export const openLeagueBroadcast = async (leagueId: number): Promise<LiveStateResponse> =>
  (await request(`/api/customer/leagues/${leagueId}/broadcast/open`, { method: 'POST' })).json()
