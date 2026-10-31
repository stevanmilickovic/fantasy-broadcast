import { request } from '../../shared/api/http'
import type {
  ClassicLeagueDiscovery,
  DraftLeagueDiscovery,
  FplLeagueType,
} from '../../shared/fpl/types'
import type { BroadcastSchedule } from '../administration/types'
import type { LiveStateResponse } from '../broadcast/types'
import type {
  FollowRequest,
  FollowResult,
  LeagueRegistrationAccess,
  RegisteredLeague,
} from './types'
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

export const followLeague = async (leagueId: number, signal?: AbortSignal): Promise<FollowResult> =>
  (await request(`/api/customer/leagues/${leagueId}/follow`, { signal, method: 'POST' })).json()

export const loadFollowRequests = async (signal?: AbortSignal): Promise<FollowRequest[]> =>
  (await request('/api/customer/follow-requests', { signal })).json()
export const loadLeagueRequests = async (
  leagueId: number,
  signal?: AbortSignal,
): Promise<FollowRequest[]> =>
  (await request(`/api/customer/leagues/${leagueId}/follow-requests`, { signal })).json()
export const cancelFollowRequest = async (leagueId: number, signal?: AbortSignal) => {
  await request(`/api/customer/leagues/${leagueId}/follow-request`, { signal, method: 'DELETE' })
}
export const setLeaguePrivacy = async (
  leagueId: number,
  privateLeague: boolean,
  signal?: AbortSignal,
) => {
  await request(`/api/customer/leagues/${leagueId}/privacy`, {
    signal,
    method: 'PATCH',
    body: JSON.stringify({ privateLeague }),
  })
}
export const decideFollowRequest = async (
  leagueId: number,
  userId: number,
  approve: boolean,
  signal?: AbortSignal,
) => {
  await request(`/api/customer/leagues/${leagueId}/follow-requests/${userId}`, {
    signal,
    method: 'POST',
    body: JSON.stringify({ approve }),
  })
}

export const registerLeague = async (
  fplLeagueId: string,
  leagueType: FplLeagueType,
  signal?: AbortSignal,
): Promise<RegisteredLeague> =>
  (
    await request('/api/customer/leagues', {
      signal,
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

export const openLeagueBroadcast = async (
  leagueId: number,
  signal?: AbortSignal,
): Promise<LiveStateResponse> =>
  (
    await request(`/api/customer/leagues/${leagueId}/broadcast/open`, { signal, method: 'POST' })
  ).json()
export const unfollowLeague = async (leagueId: number, signal?: AbortSignal): Promise<void> => {
  await request(`/api/customer/leagues/${leagueId}/follow`, { method: 'DELETE', signal })
}
