import { expect, it } from 'vitest'
import { leaguePlayersForEntry, recentMatchResults } from '../leagues/leagueData'
import {
  previewLeague,
  previewPlayerDetails,
  previewReplayGameweek,
  previewReplayStandings,
} from './previewLeagueData'

it('builds a complete round robin and reconciles each lineup with its match and standings', () => {
  const { gameweek, details } = previewLeague
  expect(gameweek).toBe(3)
  expect(previewReplayGameweek).toBe(4)
  expect(details.matches).toHaveLength(6)
  expect(
    new Set(
      details.matches.map((match) => [match.league_entry_1, match.league_entry_2].sort().join('-')),
    ).size,
  ).toBe(6)
  expect(details.matches).toContainEqual(
    expect.objectContaining({
      event: 2,
      league_entry_1_points: 49,
      league_entry_2_points: 49,
    }),
  )
  for (const entry of details.league_entries) {
    const squad = leaguePlayersForEntry(previewLeague, entry.entry_id)
    const starters = squad.filter((player) => player.starter)
    expect(starters).toHaveLength(11)
    expect(squad).toHaveLength(15)
    const form = recentMatchResults(details.matches, entry.id)
    expect(form.map((result) => result.event)).toEqual([1, 2, 3])
    for (const result of form) {
      const total = starters.reduce((points, player) => {
        const sample = previewPlayerDetails[player.id]
        const weekPoints =
          result.event === gameweek
            ? sample.points
            : sample.history.find((week) => week.gameweek === result.event)?.points
        return points + (weekPoints ?? NaN)
      }, 0)
      expect(result.points).toBe(total)
    }
    const standing = details.standings.find((row) => row.league_entry === entry.id)
    expect(standing?.total).toBe(
      form.reduce(
        (total, result) => total + (result.result === 'W' ? 3 : result.result === 'D' ? 1 : 0),
        0,
      ),
    )
    expect(standing?.points_for).toBe(form.reduce((total, result) => total + result.points, 0))
  }
  expect(previewReplayStandings.map((row) => [row.position, row.total, row.pointsFor])).toEqual(
    details.standings.map((row) => [row.rank, row.total, row.points_for]),
  )
})

it('shows a standout bench haul without adding it to the team score', () => {
  const thiago = leaguePlayersForEntry(previewLeague, 1).find((player) => player.name === 'Thiago')
  if (!thiago) throw new Error('The North Bank squad is missing Thiago')
  expect(thiago).toMatchObject({ starter: false, points: 13 })
  const details = previewPlayerDetails[thiago.id]
  expect(details.changes).toContainEqual(
    expect.objectContaining({ stat: 'goals', value: 2, points: 8 }),
  )
  expect(details.changes.reduce((sum, change) => sum + change.points, 0)).toBe(details.points)
})
