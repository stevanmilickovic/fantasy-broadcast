import { expect, test } from 'vitest'
import { welcomeLeagueDiscovery } from '../public/welcomeDemoData'
import { withLiveLeague } from './liveLeagueData'
import type { LiveLeagueProjection } from './useLiveLeague'

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
test('matchups overlay automatically while live standings remain an explicit choice', () => {
  const discovery = { ...structuredClone(welcomeLeagueDiscovery), gameweek: 24 }
  const official = withLiveLeague(discovery, live, false)
  expect(official.details.standings).toEqual(discovery.details.standings)
  expect(official.details.matches.find((match) => match.id === 900)?.league_entry_1_points).toBe(72)
  expect(withLiveLeague(discovery, live, true).details.standings[0].total).toBe(30)
  expect(
    withLiveLeague(discovery, { ...live, standingsUnavailableReason: 'History missing.' }, true)
      .details.standings,
  ).toEqual(discovery.details.standings)
  expect(withLiveLeague(discovery, { ...live, gameweek: 25 }, true)).toBe(discovery)
})
