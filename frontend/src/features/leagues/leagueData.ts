import type {
  FplLeagueScoring,
  FplStanding,
  LeagueDiscoveryState,
  PlayerAvailability,
} from '../../shared/fpl/types'
import { type ClassicLeagueDiscovery } from '../../shared/fpl/types'
export type LeaguePlayer = {
  id: number
  name: string
  fullName: string
  club: string
  position: string
  points: number
  minutes: number
  starter: boolean
  lineupPosition: number
  availability?: PlayerAvailability | null
}

export function toLeagueDiscovery(
  classic: ClassicLeagueDiscovery,
  fplLeagueId: number,
): LeagueDiscoveryState {
  const entries = classic.entries.map((entry) => ({
    id: entry.entryId,
    entry_id: entry.entryId,
    entry_name: entry.entryName,
    player_first_name: entry.playerName,
    player_last_name: '',
    short_name: '',
  }))
  const entryEvents = Object.fromEntries(
    Object.entries(classic.entryEvents).map(([id, event]) => [
      id,
      {
        picks: event.picks.map((pick) => ({
          ...pick,
          starter: pick.position <= 11,
          benched: pick.position > 11,
        })),
        automaticSubstitutions: event.automaticSubstitutions,
      },
    ]),
  )
  return {
    gameweek: classic.gameweek,
    details: {
      league: {
        id: fplLeagueId,
        name: classic.leagueName,
        draft_status: '',
        draft_dt: '',
        max_entries: entries.length,
        min_entries: 0,
        scoring: classic.scoringType,
        start_event: 0,
        stop_event: 0,
      },
      league_entries: entries,
      matches: classic.matches.map((match, index) => ({
        id: index,
        event: classic.gameweek,
        league_entry_1: match.firstEntryId,
        league_entry_2: match.secondEntryId,
        league_entry_1_points: match.firstPoints,
        league_entry_2_points: match.secondPoints,
        finished: false,
      })),
      standings: classic.entries.map((entry) => ({
        league_entry: entry.entryId,
        rank: entry.rank,
        lastRank: entry.lastRank,
        total: entry.total,
        points_for: entry.pointsFor,
      })),
    },
    elementStatus: {
      element_status: classic.entries.flatMap((entry) =>
        (classic.entryEvents[String(entry.entryId)]?.picks ?? []).map((pick) => ({
          element: pick.element,
          owner: entry.entryId,
          status: 'o',
          in_accepted_trade: false,
        })),
      ),
    },
    players: classic.players,
    entryEvents,
    livePlayers: classic.livePlayers,
  }
}

export function scoringLabel(scoringType: FplLeagueScoring) {
  return scoringType === 'H2H' ? 'Head-to-head' : 'Total points'
}

export function standingPoints(standing: FplStanding) {
  return standing.total ?? standing.headToHeadPoints ?? 0
}

export function standingGamePoints(standing: FplStanding) {
  return standing.points_for ?? standing.pointsFor ?? 0
}

export function standingEntryId(standing: FplStanding) {
  return standing.league_entry ?? standing.leagueEntryId ?? 0
}

export function standingLastRank(standing: FplStanding) {
  return standing.last_rank ?? standing.lastRank ?? null
}

export function managerName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim() || 'Manager'
}

export function leaguePlayersForEntry(
  discovery: LeagueDiscoveryState,
  entryId: number,
): LeaguePlayer[] {
  const playersById = new Map(discovery.players.map((player) => [player.id, player]))
  const livePlayersById = new Map(
    (discovery.livePlayers ?? []).map((player) => [player.id, player]),
  )
  const entryEvent = discovery.entryEvents?.[String(entryId)]
  const picksByElement = new Map((entryEvent?.picks ?? []).map((pick) => [pick.element, pick]))
  const effectivePositions = new Map(
    (entryEvent?.picks ?? []).map((pick) => [pick.element, pick.position]),
  )
  for (const substitution of entryEvent?.automaticSubstitutions ?? []) {
    const incomingPosition = effectivePositions.get(substitution.elementIn)
    const outgoingPosition = effectivePositions.get(substitution.elementOut)
    if (incomingPosition === undefined || outgoingPosition === undefined) continue
    effectivePositions.set(substitution.elementIn, outgoingPosition)
    effectivePositions.set(substitution.elementOut, incomingPosition)
  }
  return (discovery.elementStatus.element_status ?? [])
    .filter((status) => status.owner === entryId)
    .map((status) => {
      const player = playersById.get(status.element)
      const pick = picksByElement.get(status.element)
      const lineupPosition = effectivePositions.get(status.element) ?? pick?.position ?? 99
      return {
        id: status.element,
        name: player?.webName ?? `Player ${status.element}`,
        fullName: player?.fullName ?? 'Unknown player',
        club: player?.premierLeagueClub ?? 'Unknown club',
        position: player?.position ?? 'MID',
        availability: player?.availability,
        points: livePlayersById.get(status.element)?.stats.totalPoints ?? 0,
        minutes: livePlayersById.get(status.element)?.stats.minutes ?? 0,
        starter: pick ? lineupPosition <= 11 : true,
        lineupPosition,
      }
    })
    .sort(
      (first, second) =>
        first.lineupPosition - second.lineupPosition || first.name.localeCompare(second.name),
    )
}

export function groupedMatches(matches: LeagueDiscoveryState['details']['matches']) {
  return matches.reduce<Array<{ event: number; matches: typeof matches }>>((groups, match) => {
    const existing = groups.find((group) => group.event === match.event)
    if (existing) existing.matches.push(match)
    else groups.push({ event: match.event, matches: [match] })
    return groups
  }, [])
}
