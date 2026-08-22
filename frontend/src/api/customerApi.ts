import type { FplLeagueType } from './liveApi'
import type { AdminLeague, AdminLeaguePage, AuthResponse, AuthUser, RegisteredLeague } from '../types/customer'

const tokenKey = 'stk-broadcast-session-token'

const request = async (path: string, token: string, options?: RequestInit) => {
  const response = await fetch(path, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options?.headers },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.detail ?? body?.message ?? `Request failed with ${response.status}`)
  }
  return response
}

export const storedToken = () => localStorage.getItem(tokenKey)
export const storeToken = (token: string) => localStorage.setItem(tokenKey, token)
export const clearToken = () => localStorage.removeItem(tokenKey)

export const authenticate = async (path: 'login' | 'register', email: string, password: string): Promise<AuthResponse> => {
  const response = await fetch(`/api/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.detail ?? body?.message ?? 'Unable to sign in.')
  }
  return response.json()
}

export const loadCurrentUser = async (token: string): Promise<AuthUser> => (await request('/api/auth/me', token)).json()
export const logout = async (token: string) => { await request('/api/auth/logout', token, { method: 'POST' }) }
export const loadRegisteredLeagues = async (token: string): Promise<RegisteredLeague[]> => (await request('/api/customer/leagues', token)).json()
export const registerLeague = async (token: string, fplLeagueId: string, leagueType: FplLeagueType): Promise<RegisteredLeague> =>
  (await request('/api/customer/leagues', token, { method: 'POST', body: JSON.stringify({ fplLeagueId: Number(fplLeagueId), leagueType }) })).json()
export const loadAdminLeagues = async (token: string, page = 0, size = 10, search = ''): Promise<AdminLeaguePage> => {
  const query = new URLSearchParams({ page: String(page), size: String(size), search })
  const response: AdminLeaguePage | AdminLeague[] = await (await request(`/api/customer/admin/leagues?${query}`, token)).json()
  if (Array.isArray(response)) return { items: response, page: 0, size: response.length, totalItems: response.length }
  return response
}
export const updateAdminLeague = async (token: string, league: AdminLeague): Promise<AdminLeague> =>
  (await request(`/api/customer/admin/leagues/${league.id}`, token, {
    method: 'PATCH', body: JSON.stringify({ serviceEnabled: league.serviceEnabled }),
  })).json()
