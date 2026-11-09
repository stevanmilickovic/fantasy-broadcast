import type {
  FplLeagueMatch,
  FplLeagueScoring,
  LeagueDiscoveryState,
} from '../../../shared/fpl/types'
import {
  managerName,
  recentMatchResults,
  standingEntryId,
  standingLastRank,
  standingPoints,
  standingGamePoints,
} from '../leagueData'
import type { TeamEmblemData } from '../teamEmblems'
import type { LiveLeagueProjection } from '../useLiveLeague'

export type ImageRequest =
  | { kind: 'standings' }
  | { kind: 'club'; id: number }
  | { kind: 'matchups' | 'matchup'; week: number; matches: FplLeagueMatch[] }
export type ImageClub = {
  id: number
  name: string
  manager: string
  emblem: string | null
  rank: number | null
  movement: number | null
  points: number | null
  fantasyPoints: number | null
  form: Array<{ result: string; provisional: boolean }>
}
export type ImageMatch = {
  clubs: ImageClub[]
  scores: Array<number | null>
  source: 'FPL' | 'Live'
  status: string
  result: 'first' | 'second' | 'draw' | null
}
export type LeagueImage = {
  kind: ImageRequest['kind']
  league: string
  week: number
  scoring: FplLeagueScoring
  source: string
  status: string
  capturedAt: string
  stale: boolean
  clubs: ImageClub[]
  matches: ImageMatch[]
  totalClubs: number
}
export const imageTitles = {
  standings: 'League standings',
  club: 'Club spotlight',
  matchups: 'Gameweek matchups',
  matchup: 'Matchup result',
}
export function createLeagueImage({
  request,
  discovery,
  league,
  scoring,
  emblems,
  live,
  liveSelected,
  stale = false,
  capturedAt = new Date().toISOString(),
}: {
  request: ImageRequest
  discovery: LeagueDiscoveryState
  league: string
  scoring: FplLeagueScoring
  emblems: TeamEmblemData[]
  live?: LiveLeagueProjection
  liveSelected: boolean
  stale?: boolean
  capturedAt?: string
}): LeagueImage {
  if (!discovery.gameweek) throw new Error('Gameweek unavailable.')
  const gameweek = discovery.gameweek
  const matchCategory = request.kind === 'matchups' || request.kind === 'matchup'
  const liveStandings =
    liveSelected &&
    live &&
    live.gameweek === discovery.gameweek &&
    !live.standingsUnavailableReason &&
    Boolean(live.standings.length)
  const club = (id: number | undefined): ImageClub => {
    // Matchups and standings reference the league-entry ID; emblem metadata uses the FPL entry ID.
    const entry = discovery.details.league_entries.find((entry) => entry.id === id)
    const standing = discovery.details.standings.find((row) => standingEntryId(row) === id)
    const last = standing ? standingLastRank(standing) : null
    return {
      id: id ?? 0,
      name: entry?.entry_name ?? (id !== undefined && id <= 0 ? 'Average' : 'Club unavailable'),
      manager: entry ? managerName(entry.player_first_name, entry.player_last_name) : '',
      emblem: emblems.find((row) => row.entryId === entry?.entry_id)?.url ?? null,
      rank: standing?.rank ?? null,
      movement: standing && last ? last - standing.rank : null,
      points:
        standing && (standing.total ?? standing.headToHeadPoints) !== undefined
          ? standingPoints(standing)
          : null,
      fantasyPoints:
        standing && (standing.points_for ?? standing.pointsFor) !== undefined
          ? standingGamePoints(standing)
          : null,
      form:
        scoring === 'H2H' && id !== undefined
          ? recentMatchResults(discovery.details.matches, id, Boolean(liveStandings)).map(
              ({ result, provisional }) => ({ result, provisional }),
            )
          : [],
    }
  }
  const ranked = [...discovery.details.standings].sort(
    (a, b) => a.rank - b.rank || standingPoints(b) - standingPoints(a),
  )
  const matches: ImageMatch[] = matchCategory
    ? request.matches.map((match) => {
        const isLive = Boolean(
          liveSelected && match.liveStatus && match.liveStatus !== 'UNAVAILABLE',
        )
        const upcoming =
          match.liveStatus === 'UPCOMING' || (!match.finished && match.event > gameweek)
        const scores = upcoming
          ? [null, null]
          : [
              match.league_entry_1_points ?? match.firstPoints ?? null,
              match.league_entry_2_points ?? match.secondPoints ?? null,
            ]
        const [first, second] = scores
        return {
          clubs: [
            club(match.league_entry_1 ?? match.firstLeagueEntryId),
            club(match.league_entry_2 ?? match.secondLeagueEntryId),
          ],
          scores,
          source: isLive ? 'Live' : 'FPL',
          status: upcoming
            ? 'Upcoming'
            : first === null || second === null
              ? 'Scores unavailable'
              : match.finished
                ? 'Final'
                : match.liveStatus === 'LIVE'
                  ? 'Live'
                  : 'Provisional',
          result:
            upcoming || match.liveStatus === 'UNAVAILABLE' || first === null || second === null
              ? null
              : first === second
                ? 'draw'
                : first > second
                  ? 'first'
                  : 'second',
        }
      })
    : []
  const source = matchCategory
    ? [...new Set(matches.map((match) => match.source))].join(' + ') || 'FPL'
    : liveStandings
      ? 'Live'
      : 'FPL'
  return {
    kind: request.kind,
    league,
    week: matchCategory ? request.week : gameweek,
    scoring,
    source:
      liveSelected && source === 'FPL' && (!matchCategory || request.week === gameweek)
        ? 'FPL · live unavailable'
        : source,
    status: matchCategory
      ? ''
      : liveStandings
        ? live?.status === 'FINAL'
          ? 'Final'
          : live?.status === 'LIVE'
            ? 'Live'
            : live?.status === 'UPCOMING'
              ? 'Upcoming'
              : 'Provisional'
        : '',
    capturedAt,
    stale: stale && source.includes('Live'),
    totalClubs: ranked.length,
    clubs:
      request.kind === 'club'
        ? [club(request.id)]
        : request.kind === 'standings'
          ? ranked.slice(0, 12).map((row) => club(standingEntryId(row)))
          : [],
    matches,
  }
}
export function imagePages(image: LeagueImage) {
  return Math.max(1, Math.ceil(image.matches.length / 10))
}
export function imageFilename(image: LeagueImage, format: 'square' | 'story', page: number) {
  const name =
    image.league
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 70) || 'league'
  return `fantasybroadcast-${name}-${image.kind}-gw${image.week}-${format}${imagePages(image) > 1 ? `-${page + 1}` : ''}.png`
}
