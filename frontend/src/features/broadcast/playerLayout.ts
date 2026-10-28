import type { FantasyEventView, MatchupView, PlayerView } from './types'

const COMPACT_NOTIFICATION_SCREEN_INSET_RATIO = 0.05
const COMPACT_PLAYER_TOKEN_WIDTH = 104

export function compactNotificationShiftFor(
  events: FantasyEventView[],
  side: 'home' | 'away',
  index: number,
  panelBounds: DOMRect | null,
) {
  if (events.length === 0 || !panelBounds) return 0
  const screenInset = window.innerWidth * COMPACT_NOTIFICATION_SCREEN_INSET_RATIO
  const halfScreenEdge = window.innerWidth / 2
  const leftBound = side === 'home' ? screenInset : halfScreenEdge + screenInset
  const rightBound =
    side === 'home' ? halfScreenEdge - screenInset : window.innerWidth - screenInset
  const notificationWidth = Math.min(
    Math.max(...events.map(notificationWidthFor)),
    rightBound - leftBound,
  )
  const tokenWidth = Math.min(COMPACT_PLAYER_TOKEN_WIDTH, panelBounds.width * 0.75)
  const outerLane = index % 2 === 0
  const notificationCentre =
    side === 'home'
      ? outerLane
        ? panelBounds.left + tokenWidth / 2
        : panelBounds.right - tokenWidth / 2
      : outerLane
        ? panelBounds.right - tokenWidth / 2
        : panelBounds.left + tokenWidth / 2
  const notificationLeft = notificationCentre - notificationWidth / 2
  const notificationRight = notificationCentre + notificationWidth / 2
  if (notificationLeft < leftBound) return leftBound - notificationLeft
  if (notificationRight > rightBound) return rightBound - notificationRight
  return 0
}

export function totalRowPlayerPosition(index: number, count: number, rowWidth: number) {
  if (count <= 1) return { x: 50, y: 50, yOffset: 0 }
  if (!rowWidth) return { x: 50, y: 50, yOffset: 0 }
  const compactCards = window.matchMedia('(max-width: 900px)').matches
  const cardWidth = compactCards ? 70 : 110
  const adjacentDistance = cardWidth + window.innerWidth * 0.01
  const offsetFromCentre = index - (count - 1) / 2
  return { x: 50 + ((offsetFromCentre * adjacentDistance) / rowWidth) * 100, y: 50, yOffset: 0 }
}

export function totalNotificationShifts(
  rows: ReadonlyArray<readonly [string, string, PlayerView[]]>,
  managerId: string,
  latestEvents: FantasyEventView[],
  width: number,
) {
  if (!width) return new Map<string, number>()
  const notifiedPlayers = rows.flatMap(([, , players], rowIndex) =>
    players
      .map((player, index) => {
        const events = latestEvents.filter(
          (event) => event.managerId === managerId && event.playerId === player.id,
        )
        return {
          id: player.id,
          hasEvent: events.length > 0,
          width: Math.max(108, ...events.map(notificationWidthFor)),
          x: (totalRowPlayerPosition(index, players.length, width).x * width) / 100,
          y: rowIndex * 70,
        }
      })
      .filter((player) => player.hasEvent),
  )
  return notificationShiftsForPlayers(notifiedPlayers)
}

export function displayPlayerPoints(player: PlayerView, points: number) {
  return points === 0 && (player.minutes ?? 0) === 0 ? '–' : points
}

export function notificationShiftsFor(
  matchup: MatchupView,
  latestEvents: FantasyEventView[],
  pitchSize: { width: number; height: number },
) {
  if (!pitchSize.width || !pitchSize.height) return new Map<string, number>()
  const notifiedPlayers = (
    [
      ['home', matchup.home],
      ['away', matchup.away],
    ] as const
  ).flatMap(([side, team]) =>
    team.activePlayers
      .map((player) => {
        const events = latestEvents.filter(
          (event) => event.managerId === team.managerId && event.playerId === player.id,
        )
        const position = formationPosition(team.activePlayers, player, side)
        const width = Math.max(108, ...events.map(notificationWidthFor))
        return {
          id: player.id,
          hasEvent: events.length > 0,
          width,
          x: (position.x * pitchSize.width) / 100,
          y: (position.y * pitchSize.height) / 100 + position.yOffset,
        }
      })
      .filter((player) => player.hasEvent),
  )

  return notificationShiftsForPlayers(notifiedPlayers)
}

function notificationShiftsForPlayers(
  notifiedPlayers: Array<{ id: string; width: number; x: number; y: number }>,
) {
  const shifts = new Map<string, number>()
  for (let firstIndex = 0; firstIndex < notifiedPlayers.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < notifiedPlayers.length; secondIndex += 1) {
      const first = notifiedPlayers[firstIndex]
      const second = notifiedPlayers[secondIndex]
      // A notification sits below its player metadata, so rows that are slightly offset can
      // still collide with a neighbouring player's label (not just perfectly aligned rows).
      if (Math.abs(first.y - second.y) > 64) continue
      const left = first.x <= second.x ? first : second
      const right = first.x <= second.x ? second : first
      const overlap = (left.width + right.width) / 2 + 8 - (right.x - left.x)
      if (overlap <= 0) continue
      shifts.set(left.id, (shifts.get(left.id) ?? 0) - overlap / 2)
      shifts.set(right.id, (shifts.get(right.id) ?? 0) + overlap / 2)
    }
  }
  return shifts
}

export function notificationWidthFor(candidate: FantasyEventView) {
  return Math.ceil(
    candidate.type.replaceAll('_', ' ').length * 8 +
      `${candidate.pointDelta > 0 ? '+' : ''}${candidate.pointDelta} pts`.length * 7.5 +
      36,
  )
}

export function formationPosition(
  players: PlayerView[],
  player: PlayerView,
  side: 'home' | 'away',
) {
  const samePosition = players.filter((candidate) => candidate.position === player.position)
  const rowIndex = Math.max(
    0,
    samePosition.findIndex((candidate) => candidate.id === player.id),
  )
  const homeColumn =
    player.position === 'GKP'
      ? 0
      : player.position === 'DEF'
        ? 1
        : player.position === 'MID'
          ? 2
          : 3
  const homeX = 6.25 + homeColumn * 12.5
  const x = side === 'home' ? homeX : 100 - homeX
  const verticalPosition = playerVerticalPosition(rowIndex, samePosition.length)
  return { x, ...verticalPosition }
}

export function playerVerticalPosition(index: number, count: number) {
  const distanceFromCentre = index - (count - 1) / 2
  const y = 50 + distanceFromCentre * 16
  const yOffset = distanceFromCentre * 30
  return {
    y: Number.isFinite(y) ? y : 50,
    yOffset: Number.isFinite(yOffset) ? yOffset : index * 30,
  }
}
