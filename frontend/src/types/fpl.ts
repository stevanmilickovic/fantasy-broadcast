export type FplLeagueEntry = {
  id: number
  entry_id: number
  entry_name: string
  player_first_name: string
  player_last_name: string
  short_name: string
}

export type FplLeagueMatch = {
  id: number
  event: number
  league_entry_1?: number
  league_entry_2?: number
  firstLeagueEntryId?: number
  secondLeagueEntryId?: number
  league_entry_1_points?: number
  league_entry_2_points?: number
  firstPoints?: number
  secondPoints?: number
  finished: boolean
}

export type FplStanding = {
  league_entry?: number
  leagueEntryId?: number
  rank: number
  last_rank?: number | null
  lastRank?: number | null
  total?: number
  headToHeadPoints?: number
  points_for?: number
  pointsFor?: number
}

export type FplLeagueDetailsRaw = {
  league?: {
    id: number
    name: string
    draft_status: string
    draft_dt: string
    max_entries: number
    min_entries: number
    scoring: string
    start_event: number
    stop_event: number
  }
  league_entries: FplLeagueEntry[]
  matches: FplLeagueMatch[]
  standings: FplStanding[]
}

export type FplElementStatusRaw = {
  element_status: Array<{
    element: number
    owner: number | null
    status: string
    in_accepted_trade: boolean
  }>
}

export type FplPlayer = {
  id: number
  webName: string
  fullName: string
  premierLeagueClub: string
  position: string
}

export type FplEntryPick = {
  element: number
  position: number
  multiplier: number
  starter: boolean
  benched: boolean
}

export type FplEntryEvent = {
  picks: FplEntryPick[]
}

export type FplLivePlayer = {
  id: number
  stats: {
    minutes: number
    goalsScored: number
    assists: number
    cleanSheets: number
    goalsConceded: number
    ownGoals: number
    penaltiesSaved: number
    penaltiesMissed: number
    yellowCards: number
    redCards: number
    saves: number
    bonus: number
    bps: number
    totalPoints: number
  }
}

export type FplDraftEventLive = {
  fixtures: Array<{
    id: number
    event: number
    homeTeamId: number
    awayTeamId: number
    homeScore: number | null
    awayScore: number | null
    started: boolean
    finished: boolean
    minutes: number
    kickoffTime: string
  }>
}

export type LeagueDiscoveryState = {
  details: FplLeagueDetailsRaw
  elementStatus: FplElementStatusRaw
  players: FplPlayer[]
  entryEvents?: Record<string, FplEntryEvent>
  livePlayers?: FplLivePlayer[]
  draftEventLive?: FplDraftEventLive
}

export type DiscoveryTab = 'teams' | 'compositions' | 'matchups' | 'standings'
