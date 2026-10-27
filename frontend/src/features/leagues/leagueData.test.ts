import { expect, it } from 'vitest'
import { leaguePlayersForEntry, toLeagueDiscovery } from './leagueData'
import type { ClassicLeagueDiscovery } from '../../shared/fpl/types'

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
