import type { LiveStateResponse } from '../types/live'

export const loadLiveState = async (leagueId?: number, signal?: AbortSignal): Promise<LiveStateResponse> => {
  const response = await fetch(leagueId ? `/api/live-state?leagueId=${leagueId}` : '/api/live-state', { signal })
  if (!response.ok) {
    throw new Error(`Live state request failed with ${response.status}`)
  }
  return response.json()
}

const adminHeaders = (token: string) => ({ Authorization: `Bearer ${token}` })

export const postMockAction = async (action: 'start' | 'advance' | 'reset', token: string): Promise<LiveStateResponse> => {
  const response = await fetch(`/api/mock-live/${action}`, { method: 'POST', headers: adminHeaders(token) })
  if (!response.ok) {
    throw new Error(`Mock action failed with ${response.status}`)
  }
  return response.json()
}

export const startComprehensiveMock = async (token: string): Promise<LiveStateResponse> => {
  const response = await fetch('/api/mock-live/comprehensive/start', { method: 'POST', headers: adminHeaders(token) })
  if (!response.ok) {
    throw new Error(`Comprehensive mock start failed with ${response.status}`)
  }
  return response.json()
}

export const startTotalPointsMock = async (token: string): Promise<LiveStateResponse> => {
  const response = await fetch('/api/mock-live/total-points/start', { method: 'POST', headers: adminHeaders(token) })
  if (!response.ok) throw new Error(`Total-points mock request failed with ${response.status}`)
  return response.json()
}

export type FplLeagueType = 'DRAFT' | 'CLASSIC'
export type FplLeagueScoring = 'H2H' | 'TOTAL_POINTS'

export const startRealBroadcast = async (leagueId: string, leagueType: FplLeagueType, scoringType: FplLeagueScoring, token: string): Promise<LiveStateResponse> => {
  const query = new URLSearchParams({ leagueId, leagueType, scoringType })
  const response = await fetch(`/api/live-broadcast/start?${query}`, { method: 'POST', headers: adminHeaders(token) })
  if (!response.ok) {
    throw new Error(`Live broadcast start failed with ${response.status}`)
  }
  return response.json()
}
