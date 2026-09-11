import type { FplLeagueType } from './liveApi'
import type { AdminLeague, AdminLeaguePage, AdminUser, AdminUserPage, AuthOptions, AuthResponse, AuthUser, BroadcastSchedule, LeagueRegistrationAccess, PendingRegistrationResponse, RegisteredLeague } from '../types/customer'
import type { LiveStateResponse } from '../types/live'
import type { FplElementStatusRaw, FplLeagueDetailsRaw, FplLivePlayer, FplPlayer } from '../types/fpl'

const request = async (path: string, options?: RequestInit) => {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.detail ?? body?.message ?? `Request failed with ${response.status}`)
  }
  return response
}

export const authenticate = async (path: 'login', email: string, password: string): Promise<AuthResponse> => {
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

export const requestRegistration = async (email: string, password: string): Promise<PendingRegistrationResponse> => {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.detail ?? body?.message ?? 'Unable to register.')
  }
  return response.json()
}

export const verifyRegistration = async (email: string, code: string): Promise<AuthResponse> => {
  const response = await fetch('/api/auth/register/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.detail ?? body?.message ?? 'Unable to verify registration.')
  }
  return response.json()
}

export const requestPasswordReset = async (email: string): Promise<{ message: string }> =>
  (await request('/api/auth/password/forgot', { method: 'POST', body: JSON.stringify({ email }) })).json()

export const resetPassword = async (token: string, password: string): Promise<void> => {
  await request('/api/auth/password/reset', { method: 'POST', body: JSON.stringify({ token, password }) })
}

export const loadAuthOptions = async (): Promise<AuthOptions> => (await request('/api/auth/options')).json()
export const loadCurrentUser = async (): Promise<AuthUser> => (await request('/api/auth/me')).json()
export const logout = async () => { await request('/api/auth/logout', { method: 'POST' }) }
export const requestAccountDeletion = async (): Promise<{ message: string }> =>
  (await request('/api/auth/account-deletion-request', { method: 'POST' })).json()
export const loadRegisteredLeagues = async (_legacyToken?: string): Promise<RegisteredLeague[]> => { void _legacyToken; return (await request('/api/customer/leagues')).json() }
export const loadLeagueRegistrationAccess = async (_legacyToken?: string): Promise<LeagueRegistrationAccess> => { void _legacyToken; return (await request('/api/customer/league-registration')).json() }
export const searchRegisteredLeagues = async (tokenOrQuery: string, query?: string): Promise<RegisteredLeague[]> => (await request(`/api/customer/leagues/search?${new URLSearchParams({ query: query ?? tokenOrQuery })}`)).json()
export const followLeague = async (tokenOrLeagueId: string | number, leagueId?: number): Promise<RegisteredLeague> => (await request(`/api/customer/leagues/${leagueId ?? tokenOrLeagueId}/follow`, { method: 'POST' })).json()
export const deleteOwnedLeague = async (tokenOrLeagueId: string | number, leagueId?: number) => { await request(`/api/customer/leagues/${leagueId ?? tokenOrLeagueId}`, { method: 'DELETE' }) }
export const registerLeague = async (tokenOrLeagueId: string, leagueIdOrType: string | FplLeagueType, legacyType?: FplLeagueType): Promise<RegisteredLeague> => {
	const fplLeagueId = legacyType === undefined ? tokenOrLeagueId : leagueIdOrType as string
	const leagueType = legacyType ?? leagueIdOrType as FplLeagueType
	return (await request('/api/customer/leagues', { method: 'POST', body: JSON.stringify({ fplLeagueId: Number(fplLeagueId), leagueType }) })).json()
}
export type LeaguePaymentPreview = { displayName: string; managerCount: number; registrationEligible: boolean; validationMessage: string | null; checkoutReady: boolean }
export const previewLeaguePayment = async (fplLeagueId: string, leagueType: FplLeagueType): Promise<LeaguePaymentPreview> =>
  (await request(`/api/customer/league-payment/preview?${new URLSearchParams({ fplLeagueId, leagueType })}`)).json()
export type PaddleCheckout = { clientSideToken: string; priceId: string; userId: number; fplLeagueId: number; leagueType: string; plan: string; paymentSignature: string }
export const createPaddleCheckout = async (fplLeagueId: string, leagueType: FplLeagueType, plan: 'STANDARD' | 'AI_BROADCASTER'): Promise<PaddleCheckout> =>
  (await request('/api/customer/league-payment/checkout', { method: 'POST', body: JSON.stringify({ fplLeagueId: Number(fplLeagueId), leagueType, plan }) })).json()
export const loadClassicLeagueOverview = async (tokenOrLeagueId: string | number, leagueId?: number): Promise<ClassicLeagueDiscovery> => (await request(`/api/customer/leagues/${leagueId ?? tokenOrLeagueId}/overview`)).json()
export const loadDraftLeagueOverview = async (tokenOrLeagueId: string | number, leagueId?: number): Promise<DraftLeagueDiscovery> => (await request(`/api/customer/leagues/${leagueId ?? tokenOrLeagueId}/draft-overview`)).json()
export const loadFplShirts = async (_legacyToken?: string): Promise<FplClubShirt[]> => { void _legacyToken; return (await request('/api/customer/fpl/shirts')).json() }
export const loadAdminLeagues = async (tokenOrPage: string | number = 0, pageOrSize = 0, sizeOrSearch: number | string = 10, legacySearch = ''): Promise<AdminLeaguePage> => {
	const legacyCall = typeof tokenOrPage === 'string'
	const page = legacyCall ? pageOrSize : tokenOrPage
	const size = legacyCall ? sizeOrSearch as number : pageOrSize
	const search = legacyCall ? legacySearch : sizeOrSearch as string
  const query = new URLSearchParams({ page: String(page), size: String(size), search })
  const response: AdminLeaguePage | AdminLeague[] = await (await request(`/api/customer/admin/leagues?${query}`)).json()
  if (Array.isArray(response)) return { items: response, page: 0, size: response.length, totalItems: response.length }
  return response
}
export const updateAdminLeague = async (tokenOrLeague: string | AdminLeague, legacyLeague?: AdminLeague): Promise<AdminLeague> => {
	const league = legacyLeague ?? tokenOrLeague as AdminLeague
	return (await request(`/api/customer/admin/leagues/${league.id}`, {
    method: 'PATCH', body: JSON.stringify({
      serviceEnabled: league.serviceEnabled,
      aiNarrationEnabled: league.aiNarrationEnabled,
      voiceNarrationEnabled: league.voiceNarrationEnabled,
    }),
	})).json()
}
export const loadAdminUsers = async (page = 0, size = 10, search = ''): Promise<AdminUserPage> => (await request(`/api/customer/admin/users?${new URLSearchParams({ page: String(page), size: String(size), search })}`)).json()
export const promoteAdminUser = async (userId: number): Promise<AdminUser> => (await request(`/api/customer/admin/users/${userId}/admin`, { method: 'PATCH' })).json()
export const deleteAdminUser = async (userId: number) => { await request(`/api/customer/admin/users/${userId}`, { method: 'DELETE' }) }
export const loadBroadcastSchedules = async (_legacyToken?: string): Promise<BroadcastSchedule[]> => { void _legacyToken; return (await request('/api/customer/admin/broadcast-schedules')).json() }
export const saveBroadcastSchedule = async (tokenOrStartsAt: string, startsAtOrEndsAt: string, endsAtOrId?: string | number, legacyId?: number): Promise<BroadcastSchedule> => { const startsAt = legacyId === undefined ? tokenOrStartsAt : startsAtOrEndsAt; const endsAt = legacyId === undefined ? endsAtOrId as string : endsAtOrId as string; const id = legacyId === undefined ? undefined : legacyId; return (await request(id ? `/api/customer/admin/broadcast-schedules/${id}` : '/api/customer/admin/broadcast-schedules', { method: id ? 'PUT' : 'POST', body: JSON.stringify({ startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString() }) })).json() }
export const generateTodayBroadcastSchedules = async (_legacyToken?: string): Promise<BroadcastSchedule[]> => { void _legacyToken; return (await request('/api/customer/admin/broadcast-schedules/generate-today', { method: 'POST' })).json() }
export const deleteBroadcastSchedule = async (tokenOrScheduleId: string | number, scheduleId?: number) => { await request(`/api/customer/admin/broadcast-schedules/${scheduleId ?? tokenOrScheduleId}`, { method: 'DELETE' }) }
export const loadActiveBroadcastSchedules = async (_legacyToken?: string): Promise<BroadcastSchedule[]> => { void _legacyToken; return (await request('/api/customer/broadcast-schedules/active')).json() }
export const openLeagueBroadcast = async (tokenOrLeagueId: string | number, leagueId?: number): Promise<LiveStateResponse> => (await request(`/api/customer/leagues/${leagueId ?? tokenOrLeagueId}/broadcast/open`, { method: 'POST' })).json()

export type ClassicLeagueDiscovery = {
  leagueName: string
  scoringType: 'H2H' | 'TOTAL_POINTS'
  gameweek: number
  entries: Array<{ entryId: number; entryName: string; playerName: string; rank: number; lastRank?: number | null; total: number; pointsFor: number }>
  players: FplPlayer[]
  entryEvents: Record<string, { picks: Array<{ element: number; position: number; multiplier: number }> }>
  livePlayers: FplLivePlayer[]
  matches: Array<{ firstEntryId: number; secondEntryId: number; firstPoints: number; secondPoints: number }>
}

export type DraftLeagueDiscovery = {
  details: FplLeagueDetailsRaw
  elementStatus: FplElementStatusRaw
  players: FplPlayer[]
}

export type FplClubShirt = { name: string; shortName?: string; code: number }
