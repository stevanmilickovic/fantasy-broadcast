import { createContext, useContext } from 'react'

export type TeamEmblemData = {
  entryId: number
  managerId: string
  name: string
  url: string | null
}

export const TeamEmblemsContext = createContext<{
  teams: TeamEmblemData[]
  loading: boolean
  error?: string
  refresh: () => void
}>({ teams: [], loading: false, refresh: () => {} })

export const useTeamEmblems = () => useContext(TeamEmblemsContext)
