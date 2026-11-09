import { expect, test } from 'vitest'
import { welcomeLeagueDiscovery } from '../public/welcomeDemoData'
import { withLiveLeague } from './liveLeagueData'
import type { LiveLeagueProjection } from './useLiveLeague'
import { recentMatchResults } from './leagueData'

const live: LiveLeagueProjection = {
  source: 'DRAFT',
  gameweek: 24,
  pointsFetchedAt: '2026-10-01T12:00:00Z',
  fixturesFetchedAt: '2026-10-01T12:00:00Z',
  status: 'LIVE',
  baselineGameweek: 23,
  managerScores: { '1': 72, '2': 34 },
  matchups: [
    {
      id: 900,
      event: 24,
      firstManagerId: '1',
      secondManagerId: '2',
      firstPoints: 72,
      secondPoints: 34,
      status: 'LIVE',
    },
  ],
  standings: [
    {
      teamId: '2',
      teamName: 'Second',
      managerName: 'Manager',
      position: 1,
      total: 30,
      gameweekPoints: 34,
      pointsFor: 500,
    },
  ],
  scoresUnavailableReason: null,
  standingsUnavailableReason: null,
}
test('standings and matchups use live scores only when independently selected', () => {
  const discovery = { ...structuredClone(welcomeLeagueDiscovery), gameweek: 24 }
  const official = withLiveLeague(discovery, live, false)
  expect(official.details.standings).toEqual(discovery.details.standings)
  expect(official.details.matches).toEqual(discovery.details.matches)
  const matchups = withLiveLeague(discovery, live, false, true)
  expect(matchups.details.matches.find((match) => match.id === 900)?.league_entry_1_points).toBe(72)
  expect(matchups.details.standings).toEqual(discovery.details.standings)
  expect(withLiveLeague(discovery, live, true, false).details.matches).toEqual(
    discovery.details.matches,
  )
  expect(withLiveLeague(discovery, live, true).details.standings[0].total).toBe(30)
  expect(
    withLiveLeague(discovery, { ...live, standingsUnavailableReason: 'History missing.' }, true)
      .details.standings,
  ).toEqual(discovery.details.standings)
  expect(withLiveLeague(discovery, { ...live, gameweek: 25 }, true)).toBe(discovery)
})

test('live matchups retain historical and future FPL weeks and fall back when unavailable', () => {
  const discovery = { ...structuredClone(welcomeLeagueDiscovery), gameweek: 24 }
  discovery.details.matches.push(
    { ...discovery.details.matches[0], event: 23, finished: true },
    { ...discovery.details.matches[1], event: 25 },
  )
  const projected = withLiveLeague(discovery, live, false, true)
  expect(projected.details.matches.filter((match) => match.event !== 24)).toEqual(
    discovery.details.matches.filter((match) => match.event !== 24),
  )
  expect(projected.details.matches.filter((match) => match.event === 24)).toHaveLength(1)
  expect(
    withLiveLeague(
      discovery,
      { ...live, scoresUnavailableReason: 'Points unavailable.' },
      false,
      true,
    ).details.matches,
  ).toEqual(discovery.details.matches)
})

test('live form follows corrected current scores without changing completed-only form', () => {
  const discovery = { ...structuredClone(welcomeLeagueDiscovery), gameweek: 24 }
  const projected = withLiveLeague(discovery, live, true)
  const original = recentMatchResults(projected.details.matches, 1)
  expect(original.some((row) => row.id === 900)).toBe(false)
  expect(recentMatchResults(projected.details.matches, 1, true).at(-1)).toMatchObject({
    id: 900,
    result: 'W',
    provisional: true,
  })
  const corrected = withLiveLeague(
    discovery,
    { ...live, matchups: [{ ...live.matchups[0], firstPoints: 20, secondPoints: 34 }] },
    true,
  )
  expect(recentMatchResults(corrected.details.matches, 1, true).at(-1)).toMatchObject({
    result: 'L',
    points: 20,
  })
  const upcoming = withLiveLeague(
    discovery,
    { ...live, matchups: [{ ...live.matchups[0], status: 'UPCOMING' }] },
    true,
  )
  expect(recentMatchResults(upcoming.details.matches, 1, true)).toEqual(original)
})
