import { describe, expect, it } from 'vitest'
import type { FplLivePlayer, LeagueDiscoveryState } from '../../shared/fpl/types'
import { leagueInsights, rankInsightPlayers } from './leagueInsights'

function fixture(): LeagueDiscoveryState {
  const stats: FplLivePlayer['stats'] = {
    minutes: 90,
    goalsScored: 1,
    assists: 0,
    cleanSheets: 0,
    goalsConceded: 0,
    ownGoals: 0,
    penaltiesSaved: 0,
    penaltiesMissed: 0,
    yellowCards: 0,
    redCards: 0,
    saves: 0,
    bonus: 0,
    bps: 0,
    totalPoints: 10,
  }
  return {
    gameweek: 2,
    details: {
      league_entries: [1, 2].map((id) => ({
        id: id + 100,
        entry_id: id,
        entry_name: `Club ${id}`,
        player_first_name: 'Manager',
        player_last_name: String(id),
        short_name: '',
      })),
      standings: [
        { league_entry: 101, rank: 1, last_rank: 2, total: 6, points_for: 80 },
        { league_entry: 102, rank: 2, last_rank: 1, total: 3, points_for: 100 },
      ],
      matches: [],
    },
    players: [1, 2, 3].map((id) => ({
      id,
      webName: `Player ${id}`,
      fullName: `Player ${id}`,
      premierLeagueClub: 'Arsenal',
      position: 'MID',
      season: { totalPoints: 100, goalsScored: 4, assists: 2, cleanSheets: 1 },
    })),
    elementStatus: {
      element_status: [
        { element: 1, owner: 1, status: 'o', in_accepted_trade: false },
        { element: 1, owner: 2, status: 'o', in_accepted_trade: false },
        { element: 1, owner: 2, status: 'o', in_accepted_trade: false },
        { element: 2, owner: 1, status: 'o', in_accepted_trade: false },
        { element: 3, owner: null, status: 'a', in_accepted_trade: false },
      ],
    },
    entryEvents: {
      '1': {
        picks: [
          { element: 1, position: 1, multiplier: 1, starter: true, benched: false },
          { element: 2, position: 12, multiplier: 0, starter: false, benched: true },
        ],
        automaticSubstitutions: [{ elementIn: 2, elementOut: 1 }],
      },
    },
    livePlayers: [
      { id: 1, stats },
      { id: 2, stats: { ...stats, totalPoints: -2 } },
    ],
  }
}

describe('league insights', () => {
  it('resolves Draft ownership through entry_id while standings use the separate league-entry id', () => {
    const result = leagueInsights(fixture())
    expect(result.players[0].owners[0]).toMatchObject({ id: 101, entry_id: 1 })
    expect(result.clubs[0].starterPoints).toBe(-2)
    expect(result.performance[0]).toMatchObject({ rank: 1, leaguePoints: 6 })
  })

  it('counts a shared Classic player once, lists distinct owners, and excludes free agents', () => {
    const result = leagueInsights(fixture())
    expect(result.players.map((row) => row.player.id)).toEqual([1, 2])
    expect(result.players[0].owners.map((entry) => entry.entry_id)).toEqual([1, 2])
    expect(
      rankInsightPlayers(result.players, 'season', 'goalsScored').map((row) => row.value),
    ).toEqual([4, 4])
  })

  it('shares ranks for tied totals and preserves negative point totals', () => {
    const state = fixture()
    const players = leagueInsights(state).players
    expect(rankInsightPlayers(players, 'season', 'totalPoints').map((row) => row.rank)).toEqual([
      1, 1,
    ])
    expect(rankInsightPlayers(players, 'gameweek', 'totalPoints').map((row) => row.value)).toEqual([
      10, -2,
    ])
    if (state.livePlayers) state.livePlayers[0].stats.totalPoints = 0
    expect(
      rankInsightPlayers(leagueInsights(state).players, 'gameweek', 'totalPoints').map(
        (row) => row.value,
      ),
    ).toEqual([0, -2])
  })

  it('keeps missing stats distinct from a recorded zero', () => {
    const state = fixture()
    state.players[0].season = null
    state.livePlayers = []
    const players = leagueInsights(state).players
    expect(players[0].season).toBeNull()
    expect(rankInsightPlayers(players, 'season', 'goalsScored')).toHaveLength(1)
    expect(rankInsightPlayers(players, 'gameweek', 'totalPoints')).toEqual([])
    expect(rankInsightPlayers(leagueInsights(fixture()).players, 'gameweek', 'assists')).toEqual([])
  })

  it('compares cumulative scoring rank with league rank without treating league points as fantasy points', () => {
    const rows = leagueInsights(fixture()).performance
    expect(rows.map((row) => [row.entry.entry_id, row.scoringRank, row.rank, row.gap])).toEqual([
      [1, 2, 1, 1],
      [2, 1, 2, -1],
    ])
    expect(rows[0].leaguePoints).toBe(6)
    expect(rows[0].fantasyPoints).toBe(80)
  })

  it('shares scoring ranks for tied fantasy totals and omits missing cumulative totals', () => {
    const state = fixture()
    state.details.standings[0].points_for = 100
    expect(leagueInsights(state).performance.map((row) => row.scoringRank)).toEqual([1, 1])
    delete state.details.standings[0].points_for
    expect(leagueInsights(state).performance).toEqual([])
  })

  it('uses recorded substitutions for raw XI and bench output and leaves incomplete squads unavailable', () => {
    const state = fixture()
    const result = leagueInsights(state)
    expect(result.clubs[0]).toMatchObject({
      starterPoints: -2,
      benchPoints: 10,
      goals: 1,
      movement: 1,
    })
    expect(result.clubs[1]).toMatchObject({ starterPoints: null, benchPoints: null })
    state.livePlayers = state.livePlayers?.slice(0, 1)
    expect(leagueInsights(state).clubs[0].benchPoints).toBeNull()
  })
})
