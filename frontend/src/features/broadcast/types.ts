import type { PlayerAvailability } from '../../shared/fpl/types'

export type SequenceState = {
  currentStep: number
  totalSteps: number
  started: boolean
  complete: boolean
}

export type LiveStatus = {
  mode: string
  updatedAt: string
  message: string
}

export type PlayerView = {
  id: string
  displayName: string
  shortName?: string
  premierLeagueClub: string
  position: string
  lineupSlot: string
  points: number
  minutes?: number
  status: string
  recentDelta: number
  autoSubstituted?: boolean
  availability?: PlayerAvailability | null
}

export type TeamView = {
  managerId: string
  displayName: string
  clubName: string
  shortName: string
  color: string
  score: number
  automaticSubstitutions?: { playerInId: string; playerOutId: string; pointDelta: number }[]
  activePlayers: PlayerView[]
  benchPlayers: PlayerView[]
}

export type MatchupView = {
  id: string
  home: TeamView
  away: TeamView
  leaderManagerId: string
  scoreline: string
}

export type LiveStandingView = {
  teamId: string
  managerName: string
  teamName: string
  position: number
  total: number
  gameweekPoints: number
  pointsFor: number
}

export type FantasyEventView = {
  id: string
  occurredAt: string
  type: string
  managerId: string
  playerId: string
  summary: string
  pointDelta: number
  priority: number
}

export type CommentaryView = {
  id: string
  createdAt: string
  text: string
  priority: number
  status: string
  audioUrl?: string
}

export type LiveStateResponse = {
  status: LiveStatus
  sequence: SequenceState
  gameweek: number
  matchups: MatchupView[]
  teams: TeamView[]
  standings: LiveStandingView[]
  events: FantasyEventView[]
  commentary: CommentaryView[]
  voiceNarrationEnabled?: boolean
}

export type BroadcastFocus = 'multi' | string
