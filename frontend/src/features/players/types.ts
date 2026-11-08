import type { PlayerAvailability } from '../../shared/fpl/types'

export type PlayerDetails = {
  id: number
  name: string
  shortName: string
  club: string
  position: string
  photoCode: number
  availability?: PlayerAvailability | null
  gameweek: number
  points: number | null
  changes: Array<{ stat: string; value: number; points: number; fixture: number }>
  history: Array<{ gameweek: number; points: number }>
  fixtureSchedule?: PlayerFixtureSchedule
}

export type PlayerFixture = {
  id: number
  gameweek: number
  opponent: string
  home: boolean
  kickoffTime: string | null
  teamScore: number | null
  opponentScore: number | null
  status: string
  difficulty: number | null
}
export type PlayerFixtureSchedule = {
  current: PlayerFixture[]
  upcoming: Array<{ gameweek: number; fixtures: PlayerFixture[] }>
  unscheduled: PlayerFixture[]
  unavailableReason: string | null
  fetchedAt: string | null
}
