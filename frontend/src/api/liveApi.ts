import type { LiveStateResponse } from '../types/live'

export const loadLiveState = async (): Promise<LiveStateResponse> => {
  const response = await fetch('/api/live-state')
  if (!response.ok) {
    throw new Error(`Live state request failed with ${response.status}`)
  }
  return response.json()
}

export const postMockAction = async (action: 'start' | 'advance' | 'reset'): Promise<LiveStateResponse> => {
  const response = await fetch(`/api/mock-live/${action}`, { method: 'POST' })
  if (!response.ok) {
    throw new Error(`Mock action failed with ${response.status}`)
  }
  return response.json()
}
