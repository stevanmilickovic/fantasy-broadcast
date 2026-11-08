import type { LeagueDiscoveryState } from '../../shared/fpl/types'
import type { LiveLeagueProjection } from './useLiveLeague'
import { standingEntryId } from './leagueData'

export function withLiveLeague(
  discovery: LeagueDiscoveryState,
  live: LiveLeagueProjection | undefined,
  liveStandings: boolean,
): LeagueDiscoveryState {
  if (!live || live.gameweek !== discovery.gameweek) return discovery
  const matches =
    live.scoresUnavailableReason || !live.matchups.length
      ? discovery.details.matches
      : [
          ...discovery.details.matches.filter((match) => match.event !== live.gameweek),
          ...live.matchups.map((match) => {
            const recorded = discovery.details.matches.find(
              (row) =>
                row.event === live.gameweek &&
                String(row.league_entry_1 ?? row.firstLeagueEntryId) === match.firstManagerId &&
                String(row.league_entry_2 ?? row.secondLeagueEntryId) === match.secondManagerId,
            )
            if (match.firstPoints === null || match.secondPoints === null)
              return (
                recorded ?? {
                  id: match.id,
                  event: match.event,
                  league_entry_1: Number(match.firstManagerId),
                  league_entry_2: Number(match.secondManagerId),
                  finished: false,
                  liveStatus: 'UNAVAILABLE',
                }
              )
            return {
              id: match.id,
              event: match.event,
              league_entry_1: Number(match.firstManagerId),
              league_entry_2: Number(match.secondManagerId),
              league_entry_1_points: match.firstPoints,
              league_entry_2_points: match.secondPoints,
              finished: match.status === 'FINAL',
              liveStatus: match.status,
            }
          }),
        ]
  const standings =
    liveStandings && !live.standingsUnavailableReason && live.standings.length
      ? live.standings.map((row) => ({
          league_entry: Number(row.teamId),
          rank: row.position,
          total: row.total,
          points_for: row.pointsFor,
          last_rank:
            discovery.details.standings.find(
              (standing) => String(standingEntryId(standing)) === row.teamId,
            )?.rank ?? null,
        }))
      : discovery.details.standings
  return { ...discovery, details: { ...discovery.details, matches, standings } }
}
