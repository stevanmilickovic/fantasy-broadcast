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
}

export type TeamView = {
  managerId: string
  displayName: string
  clubName: string
  shortName: string
  color: string
  score: number
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
}

export type LiveStateResponse = {
  status: LiveStatus
  sequence: SequenceState
  gameweek: number
  matchups: MatchupView[]
  events: FantasyEventView[]
  commentary: CommentaryView[]
}

export type AppView = 'setup' | 'broadcast'
export type BroadcastFocus = 'multi' | string

export type RevealRect = {
  left: number
  top: number
  width: number
  height: number
  revealX: number
  revealY: number
}

export type RevealLayout = {
  home: RevealRect
  away: RevealRect
  score: RevealRect
}

export type PlayerGroup = {
  key: string
  label: string
  players: PlayerView[]
}
