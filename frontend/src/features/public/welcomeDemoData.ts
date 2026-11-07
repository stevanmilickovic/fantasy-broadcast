import type { LeagueDiscoveryState } from '../../shared/fpl/types'
import type { TeamEmblemData } from '../leagues/teamEmblems'
import type {
  FantasyEventView,
  LiveStateResponse,
  MatchupView,
  PlayerView,
  TeamView,
} from '../broadcast/types'

type DemoClub = { id: string; manager: string; club: string; shortName: string; color: string }
type DemoPlayer = [name: string, premierLeagueClub: string]
type DemoFrame = {
  matchupIndex: number
  eventTeam: number
  eventPlayer: number
  delta: number
  type: string
  commentary: string
}

const clubs: DemoClub[] = [
  { id: 'north-bank', manager: 'Alex', club: 'North Bank FC', shortName: 'NB', color: '#20e6ff' },
  { id: 'toulouse', manager: 'Mia', club: 'Expected Toulouse', shortName: 'ET', color: '#9b6bff' },
  { id: 'fuchs', manager: 'Stevan', club: 'No Fuchs Given', shortName: 'NF', color: '#00ff85' },
  {
    id: 'wanderers',
    manager: 'Luka',
    club: 'Bonus Point Wanderers',
    shortName: 'BW',
    color: '#ffcf3f',
  },
]

export const welcomeTeamEmblems: TeamEmblemData[] = clubs.map((club, index) => ({
  entryId: index + 1,
  managerId: club.id,
  name: club.club,
  url: `/demo-logos/${club.id}.png`,
}))

export const welcomeDemoFrames: DemoFrame[] = [
  {
    matchupIndex: 0,
    eventTeam: 0,
    eventPlayer: 5,
    delta: 5,
    type: 'GOAL',
    commentary:
      'Saka scores and turns the opening matchup on its head. North Bank FC now lead by four.',
  },
  {
    matchupIndex: 1,
    eventTeam: 2,
    eventPlayer: 6,
    delta: 3,
    type: 'ASSIST',
    commentary: "Palmer's assist puts No Fuchs Given one point ahead in the second contest.",
  },
  {
    matchupIndex: 0,
    eventTeam: 1,
    eventPlayer: 5,
    delta: 3,
    type: 'ASSIST',
    commentary:
      'A live assist pulls Expected Toulouse back within a single point. This one is far from settled.',
  },
  {
    matchupIndex: 1,
    eventTeam: 3,
    eventPlayer: 9,
    delta: 4,
    type: 'GOAL',
    commentary:
      'Haaland delivers a four-point swing and Bonus Point Wanderers surge into the lead.',
  },
]

export const welcomeShirtCodes = [
  { name: 'Arsenal', shortName: 'ARS', code: 3 },
  { name: 'Aston Villa', shortName: 'AVL', code: 7 },
  { name: 'Bournemouth', shortName: 'BOU', code: 91 },
  { name: 'Brentford', shortName: 'BRE', code: 94 },
  { name: 'Brighton', shortName: 'BHA', code: 36 },
  { name: 'Chelsea', shortName: 'CHE', code: 8 },
  { name: 'Coventry City', shortName: 'COV', code: 9 },
  { name: 'Everton', shortName: 'EVE', code: 11 },
  { name: 'Fulham', shortName: 'FUL', code: 54 },
  { name: 'Ipswich Town', shortName: 'IPS', code: 40 },
  { name: 'Leeds', shortName: 'LEE', code: 2 },
  { name: 'Liverpool', shortName: 'LIV', code: 14 },
  { name: 'Manchester City', shortName: 'MCI', code: 43 },
  { name: 'Manchester United', shortName: 'MUN', code: 1 },
  { name: 'Newcastle United', shortName: 'NEW', code: 4 },
  { name: 'Spurs', shortName: 'TOT', code: 6 },
]

export function welcomeBroadcastState(frameIndex: number): LiveStateResponse {
  const frame = welcomeDemoFrames[frameIndex]
  const teams = clubs.map((club, index) => demoTeam(club, index, frameIndex))
  const eventTeam = teams[frame.eventTeam]
  const eventPlayer = eventTeam.activePlayers[frame.eventPlayer]
  const event: FantasyEventView = {
    id: `welcome-event-${frameIndex}`,
    occurredAt: new Date().toISOString(),
    type: frame.type,
    managerId: eventTeam.managerId,
    playerId: eventPlayer.id,
    summary: `${eventPlayer.displayName}: ${frame.type.toLowerCase()}`,
    pointDelta: frame.delta,
    priority: 90,
  }
  const matchups: MatchupView[] = [
    matchup('match-one', teams[0], teams[1]),
    matchup('match-two', teams[2], teams[3]),
  ]
  return {
    status: { mode: 'DEMO', updatedAt: new Date().toISOString(), message: 'Live demo' },
    sequence: {
      currentStep: frameIndex + 1,
      totalSteps: welcomeDemoFrames.length,
      started: true,
      complete: false,
    },
    gameweek: 24,
    matchups,
    teams,
    standings: welcomeLiveStandings.map((standing, index) => ({
      ...standing,
      gameweekPoints: teams[index].score,
    })),
    events: [event],
    commentary: [
      {
        id: `welcome-commentary-${frameIndex}`,
        createdAt: new Date().toISOString(),
        text: frame.commentary,
        priority: 90,
        status: 'READY',
      },
    ],
  }
}

function matchup(id: string, home: TeamView, away: TeamView): MatchupView {
  return {
    id,
    home,
    away,
    leaderManagerId:
      home.score === away.score ? '' : home.score > away.score ? home.managerId : away.managerId,
    scoreline: `${home.score}-${away.score}`,
  }
}

function demoTeam(club: DemoClub, clubIndex: number, frameIndex: number): TeamView {
  const squad = squads[clubIndex]
  const openingScore = openingScores[clubIndex]
  const playedEvents = welcomeDemoFrames
    .slice(0, frameIndex + 1)
    .filter((event) => event.eventTeam === clubIndex)
  const frame = welcomeDemoFrames[frameIndex]
  const currentEvent = frame.eventTeam === clubIndex ? frame : undefined
  const activePlayers = squad.starting.map((player, index) => {
    const basePoints =
      Math.floor(openingScore / squad.starting.length) +
      (index < openingScore % squad.starting.length ? 1 : 0)
    const earned = playedEvents
      .filter((event) => event.eventPlayer === index)
      .reduce((points, event) => points + event.delta, 0)
    return demoPlayer(club.id, player, index, basePoints + earned, currentEvent)
  })
  return {
    managerId: club.id,
    displayName: club.manager,
    clubName: club.club,
    shortName: club.shortName,
    color: club.color,
    score: activePlayers.reduce((total, player) => total + player.points, 0),
    activePlayers,
    benchPlayers: squad.bench.map((player, index) => demoBenchPlayer(club.id, player, index)),
  }
}

function demoPlayer(
  clubId: string,
  [name, premierLeagueClub]: DemoPlayer,
  index: number,
  points: number,
  event?: DemoFrame,
): PlayerView {
  return {
    id: `${clubId}-player-${index}`,
    displayName: name,
    shortName: name,
    premierLeagueClub,
    position: positions[index],
    lineupSlot: String(index + 1),
    points,
    minutes: 76,
    status: 'ACTIVE',
    recentDelta: event?.eventPlayer === index ? event.delta : 0,
  }
}

function demoBenchPlayer(
  clubId: string,
  [name, premierLeagueClub]: DemoPlayer,
  index: number,
): PlayerView {
  return {
    id: `${clubId}-bench-${index}`,
    displayName: name,
    shortName: name,
    premierLeagueClub,
    position: benchPositions[index],
    lineupSlot: `B${index + 1}`,
    points: index + 1,
    minutes: 76,
    status: 'BENCH',
    recentDelta: 0,
  }
}

const positions = ['GKP', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD']
const benchPositions = ['GKP', 'DEF', 'MID', 'FWD']
const openingScores = [48, 49, 43, 45]

const squads: { starting: DemoPlayer[]; bench: DemoPlayer[] }[] = [
  {
    starting: [
      ['Raya', 'Arsenal'],
      ['Gabriel', 'Arsenal'],
      ['Gvardiol', 'Man City'],
      ['Virgil', 'Liverpool'],
      ['Hall', 'Newcastle'],
      ['Saka', 'Arsenal'],
      ['Rice', 'Arsenal'],
      ['Cherki', 'Man City'],
      ['Gakpo', 'Liverpool'],
      ['Havertz', 'Arsenal'],
      ['Evanilson', 'Bournemouth'],
    ],
    bench: [
      ['Pickford', 'Everton'],
      ['Castagne', 'Fulham'],
      ['Iwobi', 'Fulham'],
      ['Thiago', 'Brentford'],
    ],
  },
  {
    starting: [
      ['A.Becker', 'Liverpool'],
      ['De Cuyper', 'Brighton'],
      ['Tarkowski', 'Everton'],
      ['Calafiori', 'Arsenal'],
      ['Bogle', 'Leeds'],
      ['Mbeumo', 'Man Utd'],
      ['Tavernier', 'Bournemouth'],
      ['Schade', 'Brentford'],
      ['Cunha', 'Man Utd'],
      ['Isak', 'Liverpool'],
      ['Calvert-Lewin', 'Leeds'],
    ],
    bench: [
      ['Leno', 'Fulham'],
      ['Ajer', 'Brentford'],
      ['Ayari', 'Brighton'],
      ['Barry', 'Everton'],
    ],
  },
  {
    starting: [
      ['Verbruggen', 'Brighton'],
      ['Branthwaite', 'Everton'],
      ['Mykolenko', 'Everton'],
      ['White', 'Arsenal'],
      ['Jacquet', 'Liverpool'],
      ['Dewsbury-Hall', 'Everton'],
      ['Palmer', 'Chelsea'],
      ['Rogers', 'Chelsea'],
      ['Neto', 'Chelsea'],
      ['João Pedro', 'Chelsea'],
      ['Kostoulas', 'Brighton'],
    ],
    bench: [
      ['Kelleher', 'Brentford'],
      ['Boscagli', 'Brighton'],
      ['Lewis-Potter', 'Brentford'],
      ['Solanke', 'Spurs'],
    ],
  },
  {
    starting: [
      ['Donnarumma', 'Man City'],
      ['Van Hecke', 'Spurs'],
      ['Konsa', 'Arsenal'],
      ['Justin', 'Leeds'],
      ['Hill', 'Bournemouth'],
      ['Barnes', 'Newcastle'],
      ['Semenyo', 'Man City'],
      ['Manzambi', 'Aston Villa'],
      ['Enciso', 'Ipswich Town'],
      ['Haaland', 'Man City'],
      ['Marmoush', 'Spurs'],
    ],
    bench: [
      ['Kinsky', 'Spurs'],
      ['Dunk', 'Brighton'],
      ['Rudoni', 'Coventry City'],
      ['N.Jackson', 'Aston Villa'],
    ],
  },
]

const welcomeLiveStandings = [
  {
    teamId: 'north-bank',
    managerName: 'Alex',
    teamName: 'North Bank FC',
    position: 1,
    total: 42,
    pointsFor: 1284,
  },
  {
    teamId: 'toulouse',
    managerName: 'Mia',
    teamName: 'Expected Toulouse',
    position: 2,
    total: 39,
    pointsFor: 1248,
  },
  {
    teamId: 'fuchs',
    managerName: 'Stevan',
    teamName: 'No Fuchs Given',
    position: 3,
    total: 36,
    pointsFor: 1219,
  },
  {
    teamId: 'wanderers',
    managerName: 'Luka',
    teamName: 'Bonus Point Wanderers',
    position: 4,
    total: 34,
    pointsFor: 1201,
  },
]

export const welcomeLeagueDiscovery: LeagueDiscoveryState = {
  details: {
    league: {
      id: 24024,
      name: 'Sunday League Elite',
      draft_status: 'started',
      draft_dt: '',
      max_entries: 4,
      min_entries: 2,
      scoring: 'h',
      start_event: 1,
      stop_event: 38,
    },
    league_entries: clubs.map((club, index) => ({
      id: index + 1,
      entry_id: index + 1,
      entry_name: club.club,
      player_first_name: club.manager,
      player_last_name: '',
      short_name: club.shortName,
    })),
    matches: [
      {
        id: 1,
        event: 24,
        league_entry_1: 1,
        league_entry_2: 2,
        league_entry_1_points: 53,
        league_entry_2_points: 52,
        finished: false,
      },
      {
        id: 2,
        event: 24,
        league_entry_1: 3,
        league_entry_2: 4,
        league_entry_1_points: 46,
        league_entry_2_points: 49,
        finished: false,
      },
    ],
    standings: [
      { league_entry: 1, rank: 1, last_rank: 2, total: 42, points_for: 1284 },
      { league_entry: 2, rank: 2, last_rank: 1, total: 39, points_for: 1248 },
      { league_entry: 3, rank: 3, last_rank: 3, total: 36, points_for: 1219 },
      { league_entry: 4, rank: 4, last_rank: 4, total: 34, points_for: 1201 },
    ],
  },
  elementStatus: { element_status: [] },
  players: [],
}
