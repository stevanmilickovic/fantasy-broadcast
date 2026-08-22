import type { LiveStateResponse } from '../types/live'

export const loadLiveState = async (leagueId?: number): Promise<LiveStateResponse> => {
  const response = await fetch(leagueId ? `/api/live-state?leagueId=${leagueId}` : '/api/live-state')
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

export type FplLeagueType = 'DRAFT' | 'CLASSIC'

export const startRealBroadcast = async (leagueId: string, leagueType: FplLeagueType, token: string): Promise<LiveStateResponse> => {
  const query = new URLSearchParams({ leagueId, leagueType })
  const response = await fetch(`/api/live-broadcast/start?${query}`, { method: 'POST', headers: adminHeaders(token) })
  if (!response.ok) {
    throw new Error(`Live broadcast start failed with ${response.status}`)
  }
  return response.json()
}
