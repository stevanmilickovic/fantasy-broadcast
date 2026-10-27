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
}
