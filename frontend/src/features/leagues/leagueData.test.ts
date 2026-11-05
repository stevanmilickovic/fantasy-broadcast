import { expect, it } from 'vitest'
import { leaguePlayersForEntry, recentMatchResults, toLeagueDiscovery } from './leagueData'
import type { ClassicLeagueDiscovery, FplLeagueMatch } from '../../shared/fpl/types'

it('keeps classic shared-player ownership per entry and preserves bench positions', () => {
  const classic: ClassicLeagueDiscovery = {
    leagueName: 'Classic',
    scoringType: 'TOTAL_POINTS',
    gameweek: 5,
    entries: [1, 2].map((entryId) => ({
      entryId,
      entryName: `Team ${entryId}`,
      playerName: 'Manager',
      rank: entryId,
      total: 100,
      pointsFor: 20,
    })),
    players: [],
    livePlayers: [],
    matches: [],
    entryEvents: {
      '1': { picks: [{ element: 42, position: 1, multiplier: 1 }] },
      '2': { picks: [{ element: 42, position: 12, multiplier: 0 }] },
    },
  }
  const discovery = toLeagueDiscovery(classic, 42)
  expect(discovery.gameweek).toBe(5)
  expect(discovery.details.league?.scoring).toBe('TOTAL_POINTS')
  expect(leaguePlayersForEntry(discovery, 1)[0]).toMatchObject({
    id: 42,
    starter: true,
    lineupPosition: 1,
  })
  expect(leaguePlayersForEntry(discovery, 2)[0]).toMatchObject({
    id: 42,
    starter: false,
    lineupPosition: 12,
  })
  classic.entryEvents['1'] = {
    picks: [
      { element: 42, position: 1, multiplier: 1 },
      { element: 43, position: 12, multiplier: 0 },
    ],
    automaticSubstitutions: [{ elementIn: 43, elementOut: 42 }],
  }
  const substituted = toLeagueDiscovery(classic, 42)
  expect(leaguePlayersForEntry(substituted, 1)).toEqual([
    expect.objectContaining({ id: 43, starter: true, lineupPosition: 1 }),
    expect.objectContaining({ id: 42, starter: false, lineupPosition: 12 }),
  ])
})

it('shows the last five completed results in event order from either side, preserving zero scores', () => {
  const matches: FplLeagueMatch[] = [1, 2, 3, 4, 5, 6, 7].map((event) => ({
    id: event,
    event,
    firstLeagueEntryId: 101,
    secondLeagueEntryId: 202,
    firstPoints: event,
    secondPoints: 4,
    finished: event < 7,
  }))
  matches.push(
    { id: 8, event: 8, league_entry_1: 101, league_entry_2: 202, finished: true },
    {
      id: 9,
      event: 9,
      league_entry_1: 303,
      league_entry_2: 202,
      league_entry_1_points: 0,
      league_entry_2_points: 0,
      finished: true,
    },
  )
  expect(recentMatchResults([...matches].reverse(), 101).map((match) => match.result)).toEqual([
    'L',
    'L',
    'D',
    'W',
    'W',
  ])
  expect(recentMatchResults(matches, 202).map((match) => match.result)).toEqual([
    'W',
    'D',
    'L',
    'L',
    'D',
  ])
  expect(recentMatchResults(matches, 303)[0]).toMatchObject({
    result: 'D',
    points: 0,
    opponentPoints: 0,
  })
  expect(recentMatchResults(matches, 999)).toEqual([])
})

it('preserves Classic matchup gameweeks and final status without inventing legacy final results', () => {
  const classic: ClassicLeagueDiscovery = {
    leagueName: 'Classic',
    scoringType: 'H2H',
    gameweek: 7,
    entries: [],
    players: [],
    livePlayers: [],
    entryEvents: {},
    matches: [
      {
        event: 6,
        finished: true,
        firstEntryId: 10,
        secondEntryId: 20,
        firstPoints: 0,
        secondPoints: -1,
      },
      { firstEntryId: 10, secondEntryId: 20, firstPoints: 5, secondPoints: 4 },
    ],
  }
  const discovery = toLeagueDiscovery(classic, 42)
  expect(discovery.details.matches.map(({ event, finished }) => ({ event, finished }))).toEqual([
    { event: 6, finished: true },
    { event: 7, finished: false },
  ])
  expect(recentMatchResults(discovery.details.matches, 10)).toEqual([
    expect.objectContaining({ event: 6, result: 'W', points: 0, opponentPoints: -1 }),
  ])
})
