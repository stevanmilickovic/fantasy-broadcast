import type { FplLeagueScoring, FplLeagueType } from '../api/liveApi'

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
  scoringType: FplLeagueScoring
  serviceEnabled: boolean
  aiNarrationEnabled: boolean
  voiceNarrationEnabled: boolean
  ownerUserId: number
}

export type AdminLeague = RegisteredLeague & {
  ownerEmail: string | null
  registeredUsers: string | null
  createdAt: string
}

export type AdminLeaguePage = {
  items: AdminLeague[]
  page: number
  size: number
  totalItems: number
}

export type BroadcastSchedule = { id: number; startsAt: string; endsAt: string }
