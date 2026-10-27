import type { CSSProperties } from 'react'
import type {
  FantasyEventView,
  LiveStateResponse,
  MatchupView,
  PlayerGroup,
  PlayerView,
  RevealRect,
  TeamView,
} from './types'

export const TOTAL_POINTS_REVEAL_TEAM_SCALE = 4

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

export const matchupHasEvent = (
  matchup: MatchupView,
  event: FantasyEventView | undefined,
): boolean => {
  return event ? [matchup.home.managerId, matchup.away.managerId].includes(event.managerId) : false
}

export const playerGroupsForTeam = (team: TeamView): PlayerGroup[] => {
  const activePlayers = team.activePlayers
  return [
    {
      key: 'FWD',
      label: 'FWD',
      players: activePlayers.filter((player) => player.position === 'FWD'),
    },
    {
      key: 'MID',
      label: 'MID',
      players: activePlayers.filter((player) => player.position === 'MID'),
    },
    {
      key: 'DEF',
      label: 'DEF',
      players: activePlayers.filter((player) => player.position === 'DEF'),
    },
    {
      key: 'GKP',
      label: 'GKP',
      players: activePlayers.filter((player) => player.position === 'GKP'),
    },
    { key: 'BENCH', label: 'Bench', players: team.benchPlayers },
  ].filter((group) => group.players.length > 0)
}

export const splitPlayerName = (displayName: string): [string, string] => {
  const nameParts = displayName.trim().split(/\s+/)
  if (nameParts.length <= 1) {
    return [displayName, '']
  }
  return [nameParts.slice(0, -1).join(' '), nameParts.at(-1) ?? '']
}

export const playerCardName = (player: PlayerView): [string, string] => {
  return player.shortName ? [player.shortName, ''] : splitPlayerName(player.displayName)
}

export const generatedTeamShortName = (teamName: string): string => {
  const fillerWords = new Set(['OF', 'THE'])
  const words =
    teamName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .match(/[A-Z0-9]+/g) ?? []
  const meaningfulWords = words.filter((word) => !fillerWords.has(word))

  if (meaningfulWords.length === 0) {
    return 'TBD'
  }

  if (meaningfulWords.length === 1) {
    return meaningfulWords[0].slice(0, 3).padEnd(3, meaningfulWords[0][0])
  }

  if (meaningfulWords.length === 2) {
    return `${meaningfulWords[0][0]}${meaningfulWords[1].slice(0, 2)}`.slice(0, 3)
  }

  return meaningfulWords
    .slice(0, 3)
    .map((word) => word[0])
    .join('')
}

export const teamShortName = (team: TeamView): string => generatedTeamShortName(team.clubName)

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

export const toRevealRect = (rect: DOMRect, startCenterX: number): RevealRect => ({
  left: rect.left,
  top: rect.top,
  width: rect.width,
  height: rect.height,
  revealX: startCenterX - (rect.left + rect.width / 2),
  revealY: window.innerHeight / 2 - (rect.top + rect.height / 2),
})

export const toScoreRevealRect = (rect: DOMRect): RevealRect => ({
  left: rect.left,
  top: rect.top,
  width: rect.width,
  height: rect.height,
  revealX: window.innerWidth / 2 - (rect.left + rect.width / 2),
  revealY: window.innerHeight / 2 - (rect.top + rect.height / 2),
})

export const revealCopyStyle = (
  rect: RevealRect,
  scale: number,
): CSSProperties & Record<string, string | number> => ({
  left: rect.left,
  top: rect.top,
  width: rect.width,
  height: rect.height,
  '--reveal-final-left': `${rect.left}px`,
  '--reveal-final-top': `${rect.top}px`,
  '--reveal-final-width': `${rect.width}px`,
  '--reveal-final-height': `${rect.height}px`,
  '--reveal-x': `${rect.revealX}px`,
  '--reveal-y': `${rect.revealY}px`,
  '--reveal-scale': scale,
})
