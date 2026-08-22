import type { FplLeagueType } from '../api/liveApi'

export type AuthUser = {
  id: number
  email: string
  displayName: string
  role: 'USER' | 'ADMIN'
}

export type AuthResponse = {
  token: string
  user: AuthUser
}

export type RegisteredLeague = {
  id: number
  fplLeagueId: number
  displayName: string
  leagueType: FplLeagueType
  serviceEnabled: boolean
  ownerUserId: number
}

export type AdminLeague = RegisteredLeague & {
  ownerEmail: string | null
  registeredUsers: string | null
}
