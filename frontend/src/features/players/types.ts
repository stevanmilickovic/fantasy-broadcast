export type PlayerDetails = {
  id: number
  name: string
  shortName: string
  club: string
  position: string
  photoCode: number
  gameweek: number
  points: number
  changes: Array<{ stat: string; value: number; points: number; fixture: number }>
  history: Array<{ gameweek: number; points: number }>
}
