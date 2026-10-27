import type { LeagueDiscoveryState } from '../../shared/fpl/types'
import type {
  FantasyEventView,
  LiveStandingView,
  LiveStateResponse,
  MatchupView,
  PlayerView,
  TeamView,
} from '../broadcast/types'

type DemoClub = { id: string; manager: string; club: string; shortName: string; color: string }
type DemoFrame = {
  matchupIndex: number
  scores: [number, number, number, number]
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

export const welcomeDemoFrames: DemoFrame[] = [
  {
    matchupIndex: 0,
    scores: [53, 49, 43, 45],
    eventTeam: 0,
    eventPlayer: 9,
    delta: 5,
    type: 'GOAL',
    commentary:
      'Saka scores and turns the opening matchup on its head. North Bank FC now lead by four.',
  },
  {
    matchupIndex: 1,
    scores: [53, 49, 48, 45],
    eventTeam: 2,
    eventPlayer: 6,
    delta: 3,
    type: 'ASSIST',
    commentary: 'Palmer creates the equaliser. No Fuchs Given edge ahead in the second contest.',
  },
  {
    matchupIndex: 0,
    scores: [53, 52, 46, 45],
    eventTeam: 1,
    eventPlayer: 5,
    delta: 3,
    type: 'ASSIST',
    commentary:
      'A live assist pulls Expected Toulouse back within a single point. This one is far from settled.',
  },
  {
    matchupIndex: 1,
    scores: [53, 52, 46, 51],
    eventTeam: 3,
    eventPlayer: 9,
    delta: 6,
    type: 'GOAL',
    commentary: 'Watkins delivers a six-point swing and Bonus Point Wanderers surge into the lead.',
  },
]

export const welcomeShirtCodes = [
  { name: 'Arsenal', shortName: 'ARS', code: 3 },
  { name: 'Aston Villa', shortName: 'AVL', code: 7 },
  { name: 'Brentford', shortName: 'BRE', code: 94 },
  { name: 'Chelsea', shortName: 'CHE', code: 8 },
  { name: 'Liverpool', shortName: 'LIV', code: 14 },
  { name: 'Manchester City', shortName: 'MCI', code: 43 },
  { name: 'Newcastle United', shortName: 'NEW', code: 4 },
]

export function welcomeBroadcastState(frameIndex: number): LiveStateResponse {
  const frame = welcomeDemoFrames[frameIndex]
  const teams = clubs.map((club, index) =>
    demoTeam(club, frame.scores[index], index === frame.eventTeam ? frame : undefined),
  )
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
    status: { mode: 'LIVE', updatedAt: new Date().toISOString(), message: 'Live demo' },
    sequence: {
      currentStep: frameIndex + 1,
      totalSteps: welcomeDemoFrames.length,
      started: true,
      complete: false,
    },
    gameweek: 24,
    matchups,
    teams,
    standings: welcomeLiveStandings,
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

function demoTeam(club: DemoClub, score: number, event?: DemoFrame): TeamView {
  const activePlayers = playerNames.map((name, index) =>
    demoPlayer(club.id, name, index, score, event),
  )
  return {
    managerId: club.id,
    displayName: club.manager,
    clubName: club.club,
    shortName: club.shortName,
    color: club.color,
    score,
    activePlayers,
    benchPlayers: benchNames.map((name, index) => demoBenchPlayer(club.id, name, index)),
  }
}

function demoPlayer(
  clubId: string,
  name: string,
  index: number,
  score: number,
  event?: DemoFrame,
): PlayerView {
  const basePoints = Math.max(1, Math.floor(score / 11) + (index % 3) - 1)
  const points = event?.eventPlayer === index ? basePoints + event.delta : basePoints
  return {
    id: `${clubId}-player-${index}`,
    displayName: name,
    shortName: name,
    premierLeagueClub: demoPremierLeagueClubs[index],
    position: positions[index],
    lineupSlot: String(index + 1),
    points,
    minutes: 76,
    status: 'ACTIVE',
    recentDelta: event?.eventPlayer === index ? event.delta : 0,
  }
}

function demoBenchPlayer(clubId: string, name: string, index: number): PlayerView {
  return {
    id: `${clubId}-bench-${index}`,
    displayName: name,
    shortName: name,
    premierLeagueClub: demoPremierLeagueClubs[index + 2],
    position: index === 0 ? 'GKP' : 'MID',
    lineupSlot: `B${index + 1}`,
    points: index + 1,
    minutes: 0,
    status: 'BENCH',
    recentDelta: 0,
  }
}

const playerNames = [
  'Raya',
  'Saliba',
  'Gabriel',
  'Gvardiol',
  'Alexander-Arnold',
  'Palmer',
  'Mbeumo',
  'Gordon',
  'Salah',
  'Saka',
  'Watkins',
]
const benchNames = ['Pickford', 'Rogers', 'Wood', 'Robinson']
const positions = ['GKP', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD']
const demoPremierLeagueClubs = [
  'Arsenal',
  'Arsenal',
  'Arsenal',
  'Man City',
  'Liverpool',
  'Chelsea',
  'Brentford',
  'Newcastle',
  'Liverpool',
  'Arsenal',
  'Aston Villa',
]

const welcomeLiveStandings: LiveStandingView[] = [
  {
    teamId: 'north-bank',
    managerName: 'Alex',
    teamName: 'North Bank FC',
    position: 1,
    total: 42,
    gameweekPoints: 53,
    pointsFor: 1284,
  },
  {
    teamId: 'toulouse',
    managerName: 'Mia',
    teamName: 'Expected Toulouse',
    position: 2,
    total: 39,
    gameweekPoints: 52,
    pointsFor: 1248,
  },
  {
    teamId: 'fuchs',
    managerName: 'Stevan',
    teamName: 'No Fuchs Given',
    position: 3,
    total: 36,
    gameweekPoints: 46,
    pointsFor: 1219,
  },
  {
    teamId: 'wanderers',
    managerName: 'Luka',
    teamName: 'Bonus Point Wanderers',
    position: 4,
    total: 34,
    gameweekPoints: 51,
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
        league_entry_2_points: 51,
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
