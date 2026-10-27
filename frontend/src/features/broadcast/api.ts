import { request } from '../../shared/api/http'
import type { FplLeagueType } from '../../shared/fpl/types'
import type { LiveStateResponse } from './types'

export const loadLiveState = async (
  leagueId?: number,
  signal?: AbortSignal,
): Promise<LiveStateResponse> => {
  const response = await request(
    leagueId ? `/api/live-state?leagueId=${leagueId}` : '/api/live-state',
    { signal },
  )
  return response.json()
}

export const postMockAction = async (
  action: 'start' | 'advance' | 'reset',
  signal?: AbortSignal,
): Promise<LiveStateResponse> => {
  const response = await request(`/api/mock-live/${action}`, { signal, method: 'POST' })
  return response.json()
}

export type MockNarrationMode = 'NONE' | 'TEXT' | 'VOICE'

export const startComprehensiveMock = async (
  narrationMode: MockNarrationMode,
  signal?: AbortSignal,
): Promise<LiveStateResponse> => {
  const response = await request(
    `/api/mock-live/comprehensive/start?${new URLSearchParams({ narrationMode })}`,
    { signal, method: 'POST' },
  )
  return response.json()
}

export const startTotalPointsMock = async (
  narrationMode: MockNarrationMode,
  signal?: AbortSignal,
): Promise<LiveStateResponse> => {
  const response = await request(
    `/api/mock-live/total-points/start?${new URLSearchParams({ narrationMode })}`,
    { signal, method: 'POST' },
  )
  return response.json()
}

export const startRealBroadcast = async (
  leagueId: string,
  leagueType: FplLeagueType,
  signal?: AbortSignal,
): Promise<LiveStateResponse> => {
  const query = new URLSearchParams({ leagueId, leagueType })
  const response = await request(`/api/live-broadcast/start?${query}`, { signal, method: 'POST' })
  return response.json()
}
