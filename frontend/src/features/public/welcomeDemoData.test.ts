import { describe, expect, it } from 'vitest'
import { shirtCodeFor } from '../../shared/fpl/shirts'
import { welcomeBroadcastState, welcomeDemoFrames, welcomeShirtCodes } from './welcomeDemoData'

describe('homepage broadcast demo', () => {
  it('gives each draft club a complete squad without sharing players', () => {
    const { teams } = welcomeBroadcastState(0)
    const allNames: string[] = []
    for (const team of teams) {
      expect(team.activePlayers).toHaveLength(11)
      expect(team.benchPlayers).toHaveLength(4)
      const players = [...team.activePlayers, ...team.benchPlayers]
      expect(players.filter((player) => player.position === 'GKP')).toHaveLength(2)
      expect(players.filter((player) => player.position === 'DEF')).toHaveLength(5)
      expect(players.filter((player) => player.position === 'MID')).toHaveLength(5)
      expect(players.filter((player) => player.position === 'FWD')).toHaveLength(3)
      for (const player of players) {
        allNames.push(player.displayName)
        expect(shirtCodeFor(player.premierLeagueClub, welcomeShirtCodes)).toBeDefined()
      }
    }
    expect(new Set(allNames).size).toBe(60)
  })

  it.each(['Saka', 'Palmer', 'Mbeumo', 'Haaland'])(
    'credits the %s event to its sole owner',
    (name) => {
      const frameIndex = ['Saka', 'Palmer', 'Mbeumo', 'Haaland'].indexOf(name)
      const state = welcomeBroadcastState(frameIndex)
      const event = state.events[0]
      const owner = state.teams.find((team) => team.managerId === event.managerId)
      const player = owner?.activePlayers.find((candidate) => candidate.id === event.playerId)
      expect(player?.displayName).toBe(name)
      expect(player?.recentDelta).toBe(event.pointDelta)
      expect(
        state.teams.flatMap((team) => team.activePlayers).filter((p) => p.recentDelta),
      ).toEqual([player])
      expect(event.pointDelta).toBe(
        event.type === 'ASSIST' ? 3 : player?.position === 'MID' ? 5 : 4,
      )
      expect(state.matchups[welcomeDemoFrames[frameIndex].matchupIndex]).toMatchObject(
        owner?.managerId ===
          state.matchups[welcomeDemoFrames[frameIndex].matchupIndex].home.managerId
          ? { home: owner }
          : { away: owner },
      )
    },
  )

  it('keeps player totals, scores and standings consistent across preview frames', () => {
    for (let frameIndex = 0; frameIndex < welcomeDemoFrames.length; frameIndex++) {
      const state = welcomeBroadcastState(frameIndex)
      const previous = frameIndex > 0 ? welcomeBroadcastState(frameIndex - 1) : undefined
      const event = state.events[0]
      for (const [teamIndex, team] of state.teams.entries()) {
        expect(team.score).toBe(team.activePlayers.reduce((sum, player) => sum + player.points, 0))
        expect(
          state.standings.find((standing) => standing.teamId === team.managerId)?.gameweekPoints,
        ).toBe(team.score)
        if (!previous) continue
        for (const [playerIndex, player] of team.activePlayers.entries()) {
          const delta =
            team.managerId === event.managerId && player.id === event.playerId
              ? event.pointDelta
              : 0
          expect(player.points - previous.teams[teamIndex].activePlayers[playerIndex].points).toBe(
            delta,
          )
        }
      }
      for (const match of state.matchups) {
        expect(match.scoreline).toBe(`${match.home.score}-${match.away.score}`)
      }
    }
  })
})
