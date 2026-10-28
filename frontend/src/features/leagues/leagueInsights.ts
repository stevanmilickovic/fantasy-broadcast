import type { FplLeagueEntry, FplPlayer, LeagueDiscoveryState } from '../../shared/fpl/types'
import {
  leaguePlayersForEntry,
  standingEntryId,
  standingGamePoints,
  standingLastRank,
  standingPoints,
} from './leagueData'

export type InsightMetric = 'totalPoints' | 'goalsScored' | 'assists' | 'cleanSheets'
export type InsightPeriod = 'season' | 'gameweek'
type PlayerStats = NonNullable<FplPlayer['season']>
export type InsightPlayer = {
  player: FplPlayer
  owners: FplLeagueEntry[]
  season: PlayerStats | null
  gameweek: PlayerStats | null
}

export function leagueInsights(discovery: LeagueDiscoveryState) {
  const entries = discovery.details.league_entries
  const live = new Map(discovery.livePlayers?.map((player) => [player.id, player.stats]))
  const ownership = new Map<number, FplLeagueEntry[]>()
  for (const status of discovery.elementStatus.element_status) {
    const owner = entries.find((entry) => entry.entry_id === status.owner)
    if (!owner) continue
    const owners = ownership.get(status.element) ?? []
    if (!owners.some((entry) => entry.entry_id === owner.entry_id)) owners.push(owner)
    ownership.set(status.element, owners)
  }
  const players: InsightPlayer[] = discovery.players.flatMap((player) => {
    const owners = ownership.get(player.id)
    return owners
      ? [{ player, owners, season: player.season ?? null, gameweek: live.get(player.id) ?? null }]
      : []
  })
  const clubs = entries.map((entry) => {
    const standing = discovery.details.standings.find(
      (row) => standingEntryId(row) === entry.id || standingEntryId(row) === entry.entry_id,
    )
    const roster = leaguePlayersForEntry(discovery, entry.entry_id)
    const picks = discovery.entryEvents?.[String(entry.entry_id)]?.picks ?? []
    const available =
      picks.length > 0 &&
      roster.length === picks.length &&
      roster.every((player) => live.has(player.id))
    const starters = roster.filter((player) => player.starter)
    const bench = roster.filter((player) => !player.starter)
    const last = standing && standingLastRank(standing)
    return {
      entry,
      rank: standing?.rank ?? null,
      movement: standing && last ? last - standing.rank : null,
      starterPoints: available ? starters.reduce((sum, player) => sum + player.points, 0) : null,
      benchPoints: available ? bench.reduce((sum, player) => sum + player.points, 0) : null,
      goals: available
        ? starters.reduce((sum, player) => sum + (live.get(player.id)?.goalsScored ?? 0), 0)
        : null,
    }
  })
  const performance = discovery.details.standings.flatMap((standing) => {
    const club = clubs.find(
      ({ entry }) =>
        entry.id === standingEntryId(standing) || entry.entry_id === standingEntryId(standing),
    )
    if (!club || standing.rank <= 0 || (standing.points_for ?? standing.pointsFor) == null)
      return []
    return [
      {
        entry: club.entry,
        rank: standing.rank,
        fantasyPoints: standingGamePoints(standing),
        leaguePoints: standingPoints(standing),
      },
    ]
  })
  const completePerformance = performance.length === clubs.length && clubs.length > 1
  return {
    players,
    clubs,
    performance: (completePerformance && performance.some((row) => row.fantasyPoints !== 0)
      ? performance
      : []
    )
      .map((row) => {
        const scoringRank =
          1 + performance.filter((other) => other.fantasyPoints > row.fantasyPoints).length
        return { ...row, scoringRank, gap: scoringRank - row.rank }
      })
      .sort((a, b) => b.gap - a.gap || a.rank - b.rank),
  }
}

export function rankInsightPlayers(
  players: InsightPlayer[],
  period: InsightPeriod,
  metric: InsightMetric,
) {
  const ranked = players
    .flatMap((player) => {
      const value = player[period]?.[metric]
      return value != null && (metric === 'totalPoints' || value !== 0)
        ? [{ ...player, value }]
        : []
    })
    .sort((a, b) => b.value - a.value || a.player.webName.localeCompare(b.player.webName))
  if (ranked.every((player) => player.value === 0)) return []
  return ranked.map((player) => ({
    ...player,
    rank: ranked.findIndex((other) => other.value === player.value) + 1,
  }))
}
