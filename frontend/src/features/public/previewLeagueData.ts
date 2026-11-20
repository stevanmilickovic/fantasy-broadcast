import type { FplLeagueMatch, FplLivePlayer, LeagueDiscoveryState } from '../../shared/fpl/types'
import type { PlayerDetails } from '../players/types'
import { welcomeBroadcastState, welcomeLeagueDiscovery } from './welcomeDemoData'

type Performance = {
  minutes?: number
  goals?: number
  assists?: number
  saves?: number
  bonus?: number
  yellow?: boolean
  penaltySaved?: boolean
}

type Matchday = {
  week: number
  pairings: [number, number][]
  cleanSheets: string[]
  concededTwice: string[]
  performances: Record<string, Performance>
}

const matchdays: Matchday[] = [
  {
    week: 1,
    pairings: [
      [1, 2],
      [3, 4],
    ],
    cleanSheets: ['Everton', 'Brighton', 'Spurs'],
    concededTwice: ['Leeds', 'Aston Villa'],
    performances: {
      Raya: { saves: 6, penaltySaved: true, bonus: 3 },
      Gabriel: { yellow: true },
      Saka: { goals: 1, assists: 1, bonus: 2 },
      Rice: { assists: 1 },
      Cherki: { minutes: 28 },
      Havertz: { goals: 1 },
      Evanilson: { minutes: 72, yellow: true },
      Pickford: { saves: 3 },
      Thiago: { goals: 1 },
      'A.Becker': { saves: 3 },
      Tarkowski: { bonus: 2 },
      Mbeumo: { assists: 1 },
      Schade: { minutes: 23 },
      Cunha: { goals: 1, bonus: 2 },
      Barry: { minutes: 0 },
      Verbruggen: { saves: 3 },
      Branthwaite: { yellow: true },
      White: { minutes: 22 },
      Palmer: { goals: 1, bonus: 2 },
      Neto: { minutes: 26 },
      Kostoulas: { minutes: 21 },
      Solanke: { goals: 1 },
      Donnarumma: { saves: 3 },
      'Van Hecke': { bonus: 2 },
      Barnes: { assists: 1 },
      Semenyo: { assists: 1, bonus: 1 },
      Manzambi: { minutes: 12 },
      Haaland: { goals: 1 },
      Marmoush: { assists: 1 },
      'N.Jackson': { minutes: 11 },
    },
  },
  {
    week: 2,
    pairings: [
      [1, 3],
      [4, 2],
    ],
    cleanSheets: ['Arsenal', 'Liverpool', 'Leeds'],
    concededTwice: ['Brighton', 'Chelsea'],
    performances: {
      Gabriel: { bonus: 1 },
      Gvardiol: { yellow: true },
      Virgil: { yellow: true },
      Saka: { minutes: 89, assists: 1 },
      Rice: { goals: 1, bonus: 3 },
      Gakpo: { minutes: 24 },
      Havertz: { minutes: 77 },
      Evanilson: { goals: 1 },
      Thiago: { goals: 1 },
      'A.Becker': { saves: 3 },
      Tarkowski: { yellow: true },
      Bogle: { assists: 1 },
      Mbeumo: { goals: 1, assists: 1, bonus: 3 },
      Schade: { assists: 1 },
      Cunha: { goals: 1 },
      Isak: { goals: 1, bonus: 2 },
      'Calvert-Lewin': { goals: 1 },
      Ayari: { minutes: 23 },
      Verbruggen: { saves: 6, bonus: 1 },
      Branthwaite: { yellow: true },
      White: { minutes: 76 },
      Jacquet: { minutes: 88 },
      'Dewsbury-Hall': { assists: 1 },
      Palmer: { goals: 1, bonus: 3 },
      Rogers: { assists: 1 },
      Neto: { minutes: 15 },
      'João Pedro': { goals: 1, bonus: 2 },
      Kostoulas: { minutes: 31 },
      Solanke: { minutes: 20 },
      Donnarumma: { saves: 3 },
      Konsa: { bonus: 1 },
      Hill: { yellow: true },
      Barnes: { minutes: 25 },
      Manzambi: { minutes: 23 },
      Haaland: { goals: 1 },
      Marmoush: { minutes: 18 },
      Kinsky: { minutes: 0 },
    },
  },
  {
    week: 3,
    pairings: [
      [4, 1],
      [2, 3],
    ],
    cleanSheets: ['Bournemouth', 'Chelsea', 'Man City'],
    concededTwice: ['Arsenal', 'Everton', 'Spurs'],
    performances: {
      Raya: { saves: 3 },
      Gabriel: { yellow: true },
      Virgil: { bonus: 1 },
      Saka: { assists: 1 },
      Gakpo: { goals: 1 },
      Havertz: { minutes: 31 },
      Evanilson: { goals: 1, bonus: 2 },
      Thiago: { goals: 2, bonus: 3 },
      'A.Becker': { saves: 3 },
      'De Cuyper': { minutes: 34 },
      Tarkowski: { yellow: true },
      Mbeumo: { assists: 1 },
      Tavernier: { assists: 1, bonus: 1 },
      Schade: { minutes: 27 },
      Cunha: { goals: 1 },
      Isak: { minutes: 30 },
      Leno: { saves: 6 },
      Barry: { minutes: 17 },
      Verbruggen: { saves: 3 },
      Mykolenko: { yellow: true },
      White: { minutes: 21 },
      Palmer: { goals: 1, assists: 1, bonus: 3 },
      Rogers: { assists: 1 },
      Neto: { minutes: 65 },
      'João Pedro': { goals: 1, bonus: 2 },
      Kostoulas: { minutes: 19 },
      Kelleher: { saves: 6 },
      Donnarumma: { saves: 3 },
      Justin: { yellow: true },
      Hill: { bonus: 2 },
      Semenyo: { assists: 1 },
      Manzambi: { minutes: 29 },
      Enciso: { minutes: 34 },
      Haaland: { goals: 2, bonus: 3 },
      Marmoush: { minutes: 24 },
      Kinsky: { minutes: 0 },
    },
  },
]

// Reuse the same lineups and positions as the replay. Numeric IDs are local to the preview.
const teams = welcomeBroadcastState(0).teams
const entries = welcomeLeagueDiscovery.details.league_entries
const squads = teams.map((team, teamIndex) =>
  [...team.activePlayers, ...team.benchPlayers].map((player, playerIndex) => ({
    id: teamIndex * 15 + playerIndex + 1,
    webName: player.shortName ?? player.displayName,
    fullName: player.displayName,
    premierLeagueClub: player.premierLeagueClub,
    position: player.position,
  })),
)
const players = squads.flat()

function resultFor(player: (typeof players)[number], matchday: Matchday) {
  const {
    minutes = 90,
    goals = 0,
    assists = 0,
    saves = 0,
    bonus = 0,
    yellow = false,
    penaltySaved = false,
  } = matchday.performances[player.webName] ?? {}
  const { position, premierLeagueClub } = player
  const defender = position === 'GKP' || position === 'DEF'
  const playedAnHour = minutes >= 60
  const clubKeptCleanSheet = matchday.cleanSheets.includes(premierLeagueClub)
  const cleanSheet = playedAnHour && clubKeptCleanSheet
  const goalsConceded =
    !minutes || clubKeptCleanSheet ? 0 : matchday.concededTwice.includes(premierLeagueClub) ? 2 : 1
  const goalValue = position === 'GKP' ? 10 : position === 'DEF' ? 6 : position === 'MID' ? 5 : 4
  const changes = [
    { stat: `${minutes} minutes played`, value: 1, points: playedAnHour ? 2 : minutes > 0 ? 1 : 0 },
    { stat: 'goals', value: goals, points: goals * goalValue },
    { stat: 'assists', value: assists, points: assists * 3 },
    {
      stat: 'clean sheet',
      value: Number(cleanSheet),
      points: cleanSheet ? (defender ? 4 : position === 'MID' ? 1 : 0) : 0,
    },
    { stat: 'saves', value: saves, points: Math.floor(saves / 3) },
    { stat: 'penalty saved', value: Number(penaltySaved), points: penaltySaved ? 5 : 0 },
    {
      stat: 'goals conceded',
      value: goalsConceded,
      points: defender ? -Math.floor(goalsConceded / 2) : 0,
    },
    { stat: 'yellow card', value: Number(yellow), points: yellow ? -1 : 0 },
    { stat: 'bonus', value: 1, points: bonus },
  ]
    .filter((change) => change.points !== 0)
    .map((change) => ({ ...change, fixture: 0 }))
  const stats: FplLivePlayer['stats'] = {
    minutes,
    goalsScored: goals,
    assists,
    cleanSheets: Number(cleanSheet),
    goalsConceded,
    ownGoals: 0,
    penaltiesSaved: Number(penaltySaved),
    penaltiesMissed: 0,
    yellowCards: Number(yellow),
    redCards: 0,
    saves,
    bonus,
    bps: 0,
    totalPoints: changes.reduce((total, change) => total + change.points, 0),
  }
  return { id: player.id, stats, changes }
}

const weeks = matchdays.map((matchday) => ({
  ...matchday,
  players: players.map((player) => resultFor(player, matchday)),
}))
const latest = weeks[weeks.length - 1]
export const previewReplayGameweek = latest.week + 1
const score = (week: (typeof weeks)[number], entry: number) =>
  squads[entry - 1]
    .slice(0, 11)
    .reduce((total, player) => total + week.players[player.id - 1].stats.totalPoints, 0)
const matches = weeks.flatMap(
  (week) =>
    week.pairings.map(([home, away], index) => ({
      id: week.week * 10 + index,
      event: week.week,
      league_entry_1: home,
      league_entry_2: away,
      league_entry_1_points: score(week, home),
      league_entry_2_points: score(week, away),
      finished: true,
      liveStatus: 'FINAL',
    })) satisfies FplLeagueMatch[],
)

function standingsThrough(week: number) {
  return entries
    .map((entry) => {
      let total = 0
      let pointsFor = 0
      for (const match of matches) {
        if (match.event > week) continue
        const home = match.league_entry_1 === entry.id
        if (!home && match.league_entry_2 !== entry.id) continue
        const points = home ? match.league_entry_1_points : match.league_entry_2_points
        const opponent = home ? match.league_entry_2_points : match.league_entry_1_points
        total += points > opponent ? 3 : points === opponent ? 1 : 0
        pointsFor += points
      }
      return { league_entry: entry.id, total, points_for: pointsFor }
    })
    .sort((a, b) => b.total - a.total || b.points_for - a.points_for)
    .map((standing, index) => ({ ...standing, rank: index + 1 }))
}

const previous = standingsThrough(latest.week - 1)
const standings = standingsThrough(latest.week).map((standing) => ({
  ...standing,
  last_rank: previous.find((row) => row.league_entry === standing.league_entry)?.rank,
}))

export const previewLeague: LeagueDiscoveryState = {
  gameweek: latest.week,
  details: { ...welcomeLeagueDiscovery.details, matches, standings },
  players,
  elementStatus: {
    element_status: squads.flatMap((squad, index) =>
      squad.map((player) => ({
        element: player.id,
        owner: entries[index].entry_id,
        status: 'o',
        in_accepted_trade: false,
      })),
    ),
  },
  entryEvents: Object.fromEntries(
    squads.map((squad, club) => [
      entries[club].entry_id,
      {
        picks: squad.map((player, index) => ({
          element: player.id,
          position: index + 1,
          multiplier: index < 11 ? 1 : 0,
          starter: index < 11,
          benched: index >= 11,
        })),
      },
    ]),
  ),
  livePlayers: latest.players,
}

export const previewPlayerDetails: Record<number, PlayerDetails> = Object.fromEntries(
  players.map((player) => {
    const { stats, changes } = latest.players[player.id - 1]
    return [
      player.id,
      {
        id: player.id,
        name: player.fullName,
        shortName: player.webName,
        club: player.premierLeagueClub,
        position: player.position,
        photoCode: 0,
        gameweek: latest.week,
        points: stats.totalPoints,
        changes,
        history: weeks.slice(0, -1).map((week) => ({
          gameweek: week.week,
          points: week.players[player.id - 1].stats.totalPoints,
        })),
      },
    ]
  }),
)

export const previewReplayStandings = standings.map((standing) => {
  const team = teams[standing.league_entry - 1]
  return {
    teamId: team.managerId,
    managerName: team.displayName,
    teamName: team.clubName,
    position: standing.rank,
    total: standing.total,
    pointsFor: standing.points_for,
  }
})
