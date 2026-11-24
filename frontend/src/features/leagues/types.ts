import type { FplLeagueScoring, FplLeagueType } from '../../shared/fpl/types'
export type LeagueRegistrationAccess = {
  canRegisterLeague: boolean
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
  privateLeague?: boolean
  followStatus?: 'APPROVED' | 'PENDING' | 'REJECTED'
}

export type FollowResult = { league: RegisteredLeague; status: 'PENDING' | 'APPROVED' }
export type LeagueFollower = { userId: number; displayName: string }
export type FollowRequest = {
  userId: number
  leagueId: number
  leagueName: string
  displayName: string
  status: 'PENDING' | 'REJECTED'
  createdAt: string
}
