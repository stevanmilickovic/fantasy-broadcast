import type { LiveStateResponse, MatchupView } from './types'

export const findFocusedMatchup = (state: LiveStateResponse | null): MatchupView | undefined => {
  if (!state) {
    return undefined
  }

  const latestEvent = state.events?.[0]
  if (!latestEvent) return state.matchups?.[0]
  return state.matchups?.find((candidate) =>
    [candidate.home.managerId, candidate.away.managerId].includes(latestEvent.managerId),
  )
}

export const formatScoreline = (scoreline: string): string => {
  const scoreMatch = scoreline.match(/^(-?\d+)-(-?\d+)$/)
  if (!scoreMatch) {
    return scoreline
  }

  const firstScore = Number(scoreMatch[1])
  const secondScore = Number(scoreMatch[2])
  return firstScore < 0 || secondScore < 0
    ? `${firstScore} to ${secondScore}`
    : `${firstScore}-${secondScore}`
}
