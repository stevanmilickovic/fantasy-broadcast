import { expect, test } from 'vitest'
import { welcomeLeagueDiscovery } from '../../public/welcomeDemoData'
import { createLeagueImage, imageFilename, imagePages, type ImageRequest } from './imageData'
import { withLiveLeague } from '../liveLeagueData'
import type { LiveLeagueProjection } from '../useLiveLeague'

const live: LiveLeagueProjection = {
  source: 'DRAFT',
  gameweek: 24,
  pointsFetchedAt: '2026-11-09T12:00:00Z',
  fixturesFetchedAt: '2026-11-09T12:00:00Z',
  status: 'PROVISIONAL',
  baselineGameweek: 23,
  managerScores: { '101': 70, '102': 0 },
  matchups: [
    {
      id: 0,
      event: 24,
      firstManagerId: '101',
      secondManagerId: '102',
      firstPoints: 70,
      secondPoints: 0,
      status: 'PROVISIONAL',
    },
  ],
  standings: [
    {
      teamId: '102',
      teamName: 'Two',
      managerName: 'Manager',
      position: 1,
      total: 24,
      gameweekPoints: 0,
      pointsFor: 700,
    },
  ],
  scoresUnavailableReason: null,
  standingsUnavailableReason: null,
}
function fixture() {
  const discovery = structuredClone(welcomeLeagueDiscovery)
  discovery.gameweek = 24
  discovery.details.league_entries = Array.from({ length: 15 }, (_, index) => ({
    ...discovery.details.league_entries[0],
    id: index + 101,
    entry_id: index + 1001,
    entry_name: `Club ${index + 1}`,
  }))
  discovery.details.standings = discovery.details.league_entries.map((entry, index) => ({
    league_entry: entry.id,
    rank: index + 1,
    total: 40 - index,
    last_rank: index === 0 ? null : index + 2,
    points_for: 1000 - index,
  }))
  discovery.details.matches = [
    {
      id: 0,
      event: 24,
      league_entry_1: 101,
      league_entry_2: 102,
      league_entry_1_points: 0,
      league_entry_2_points: -1,
      finished: false,
    },
  ]
  return discovery
}
function snapshot(request: ImageRequest = { kind: 'standings' }) {
  return createLeagueImage({
    request,
    discovery: fixture(),
    league: 'Sunday league',
    scoring: 'H2H',
    emblems: [{ entryId: 1001, managerId: '101', name: 'Club 1', url: '/crest.png' }],
    liveSelected: false,
    capturedAt: '2026-11-09T12:00:00Z',
  })
}
test('top twelve preserve ranks, movement and separate Draft emblem identities', () => {
  const image = snapshot()
  expect(image.clubs).toHaveLength(12)
  expect(image.totalClubs).toBe(15)
  expect(image.clubs[0]).toMatchObject({
    name: 'Club 1',
    emblem: '/crest.png',
    rank: 1,
    movement: null,
    points: 40,
    fantasyPoints: 1000,
  })
  expect(image.clubs[1].movement).toBe(1)
  const individual = snapshot({ kind: 'club', id: 115 })
  expect(individual.clubs[0]).toMatchObject({ id: 115, rank: 15 })
})
test('matchups preserve negative and zero scores, draws, unavailable and future results', () => {
  const matches = fixture().details.matches
  const image = snapshot({ kind: 'matchup', week: 24, matches })
  expect(image.matches[0]).toMatchObject({
    scores: [0, -1],
    result: 'first',
    source: 'FPL',
    status: 'Provisional',
  })
  expect(
    snapshot({ kind: 'matchup', week: 25, matches: [{ ...matches[0], event: 25 }] }).matches[0],
  ).toMatchObject({ scores: [null, null], result: null, status: 'Upcoming' })
  expect(
    snapshot({
      kind: 'matchup',
      week: 24,
      matches: [{ ...matches[0], league_entry_2_points: 0, finished: true }],
    }).matches[0],
  ).toMatchObject({ result: 'draw', status: 'Final' })
  expect(
    snapshot({
      kind: 'matchup',
      week: 24,
      matches: [{ ...matches[0], league_entry_2_points: undefined }],
    }).matches[0],
  ).toMatchObject({ result: null, status: 'Scores unavailable' })
})
test('live source reflects the actual projection and FPL fallback including historical weeks', () => {
  const discovery = fixture()
  const projected = withLiveLeague(discovery, live, true, true)
  const create = (request: ImageRequest, state = projected, projection = live) =>
    createLeagueImage({
      request,
      discovery: state,
      league: 'League',
      scoring: 'H2H',
      emblems: [],
      liveSelected: true,
      live: projection,
      stale: true,
    })
  expect(create({ kind: 'standings' })).toMatchObject({
    source: 'Live',
    status: 'Provisional',
    stale: true,
  })
  expect(
    create({ kind: 'matchup', week: 24, matches: projected.details.matches }).matches[0],
  ).toMatchObject({ source: 'Live', scores: [70, 0] })
  expect(
    create({ kind: 'standings' }, discovery, {
      ...live,
      standingsUnavailableReason: 'Unavailable',
    }),
  ).toMatchObject({ source: 'FPL · live unavailable', stale: false })
  expect(
    create({
      kind: 'matchup',
      week: 23,
      matches: [{ ...discovery.details.matches[0], event: 23, finished: true }],
    }).matches[0].source,
  ).toBe('FPL')
})
test('snapshot data does not change with its input and pagination never truncates fixtures', () => {
  const discovery = fixture()
  const image = createLeagueImage({
    request: { kind: 'standings' },
    discovery,
    league: 'League',
    scoring: 'TOTAL_POINTS',
    emblems: [],
    liveSelected: false,
  })
  discovery.details.league_entries[0].entry_name = 'Changed'
  discovery.details.standings[0].total = 1
  expect(image.clubs[0]).toMatchObject({ name: 'Club 1', points: 40, form: [] })
  const collection = snapshot({
    kind: 'matchups',
    week: 24,
    matches: Array.from({ length: 21 }, () => discovery.details.matches[0]),
  })
  expect(imagePages(collection)).toBe(3)
  expect(imageFilename(collection, 'story', 2)).toBe(
    'fantasybroadcast-Sunday-league-matchups-gw24-story-3.png',
  )
})
