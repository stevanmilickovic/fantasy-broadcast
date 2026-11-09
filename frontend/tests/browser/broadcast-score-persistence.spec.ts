import { expect, test, type Page } from '@playwright/test'
import { mockBroadcast } from './broadcastFixtures'
import type { LiveStateResponse } from '../../src/features/broadcast/types'

function update(
  input: LiveStateResponse,
  managerId: string,
  playerId: string,
  delta: number,
  id: string,
) {
  const state = structuredClone(input)
  const teams = new Set([
    ...state.teams,
    ...state.matchups.flatMap((match) => [match.home, match.away]),
  ])
  for (const team of teams) {
    if (team.managerId !== managerId) continue
    team.score += delta
    const player = [...team.activePlayers, ...team.benchPlayers].find(
      (player) => player.id === playerId,
    )
    if (player) player.points += delta
  }
  for (const match of state.matchups) match.scoreline = `${match.home.score}-${match.away.score}`
  state.events = [
    {
      id,
      managerId,
      playerId,
      pointDelta: delta,
      type: delta > 0 ? 'GOAL' : 'POINT_CORRECTION',
      summary: 'Score update',
      priority: 90,
      occurredAt: new Date().toISOString(),
    },
  ]
  state.status.updatedAt = new Date().toISOString()
  return state
}
async function send(page: Page, state: LiveStateResponse) {
  await page.evaluate(
    (state) => window.dispatchEvent(new CustomEvent('broadcast-test-update', { detail: state })),
    state,
  )
}
async function pin(page: Page, totalPoints: boolean, state: LiveStateResponse) {
  const label = totalPoints
    ? `${state.teams[0].clubName} ${state.teams[0].score} pts`
    : `${state.matchups[0].home.clubName} · ${state.matchups[0].away.clubName} ${state.matchups[0].scoreline}`
  const picker = page.getByRole('button', { name: /^Choose (match|club)$/ })
  if (await picker.isVisible()) {
    await picker.click()
    await page
      .getByRole('dialog', { name: 'Broadcast focus' })
      .getByRole('button', { name: label })
      .click()
  } else await page.locator('.match-chip-track').getByRole('button', { name: label }).click()
}
function scoreline(totalPoints: boolean, score: number, state: LiveStateResponse) {
  return totalPoints ? `${score}pts` : `${score}–${state.matchups[0].away.score}`
}

for (const totalPoints of [false, true]) {
  const mode = totalPoints ? 'total-points' : 'H2H'
  test(`${mode} retains a single player and team update after its notification expires`, async ({
    page,
  }) => {
    const { state, errors } = await mockBroadcast(page, totalPoints, (state) => {
      state.events = []
    })
    await page.clock.install()
    await page.goto('/broadcast?leagueId=1')
    await expect(page.locator('.broadcast-scene')).toHaveAttribute('data-phase', 'idle')
    await pin(page, totalPoints, state)
    const team = state.teams[0],
      player = team.activePlayers[5]
    const card = page.locator(
      `.broadcast-player[data-manager-id="${team.managerId}"][data-player-id="${player.id}"]`,
    )
    await send(page, update(state, team.managerId, player.id, 5, 'single-update'))
    await page.clock.runFor(1200)
    await expect(card).toHaveAttribute('data-player-points', String(player.points + 5))
    await expect(card).toHaveClass(/has-event/)
    await expect(page.locator('.broadcast-score')).toHaveText(
      scoreline(totalPoints, team.score + 5, state),
    )
    await page.clock.fastForward(10001)
    await page.clock.runFor(500)
    await expect(card).not.toHaveClass(/has-event/)
    await expect(card).toHaveAttribute('data-player-points', String(player.points + 5))
    await expect(page.locator('.broadcast-score')).toHaveText(
      scoreline(totalPoints, team.score + 5, state),
    )
    expect(errors).toEqual([])
  })

  for (const delta of [6, -6]) {
    test(`${mode} preserves an announced ${delta > 0 ? 'increase' : 'deduction'} while older notifications play and future points wait`, async ({
      page,
    }) => {
      const { state, errors } = await mockBroadcast(page, totalPoints, (state) => {
        state.events = []
      })
      await page.clock.install()
      await page.goto('/broadcast?leagueId=1')
      await expect(page.locator('.broadcast-scene')).toHaveAttribute('data-phase', 'idle')
      await pin(page, totalPoints, state)
      const team = state.teams[0],
        player = team.activePlayers[5],
        other = state.teams[2]
      const card = page.locator(
        `.broadcast-player[data-manager-id="${team.managerId}"][data-player-id="${player.id}"]`,
      )
      const first = update(state, team.managerId, player.id, 1, 'first-update')
      const oldOther = update(first, other.managerId, other.activePlayers[0].id, 1, 'other-update')
      oldOther.events = [...first.events, ...oldOther.events]
      await send(page, oldOther)
      await page.clock.runFor(1200)
      const latest = update(oldOther, team.managerId, player.id, delta, 'newest-update')
      await send(page, latest)
      await page.clock.fastForward(10001)
      await page.clock.runFor(1200)
      const announcedScore = team.score + 1 + delta
      const announcedPoints = player.points + 1 + delta
      await expect(card).toHaveClass(/has-event/)
      await expect(card).toHaveAttribute('data-player-points', String(announcedPoints))
      await expect(page.locator('.broadcast-score')).toHaveText(
        scoreline(totalPoints, announcedScore, state),
      )

      const future = update(latest, team.managerId, player.id, 1, 'future-update')
      await send(page, future)
      await expect(card).toHaveAttribute('data-player-points', String(announcedPoints))
      await page.clock.fastForward(10001)
      await page.clock.runFor(500)
      await expect(card).not.toHaveClass(/has-event/)
      await expect(card).toHaveAttribute('data-player-points', String(announcedPoints))
      await expect(page.locator('.broadcast-score')).toHaveText(
        scoreline(totalPoints, announcedScore, state),
      )
      await page.screenshot({
        path: test.info().outputPath('scores-retained-during-older-notification.png'),
      })

      await page.clock.fastForward(10001)
      await page.clock.runFor(1200)
      await expect(card).toHaveClass(/has-event/)
      await expect(card).toHaveAttribute('data-player-points', String(announcedPoints + 1))
      await expect(page.locator('.broadcast-score')).toHaveText(
        scoreline(totalPoints, announcedScore + 1, state),
      )
      await page.clock.fastForward(10001)
      await page.clock.runFor(500)
      await expect(card).not.toHaveClass(/has-event/)
      await expect(card).toHaveAttribute('data-player-points', String(announcedPoints + 1))
      await expect(page.locator('.broadcast-score')).toHaveText(
        scoreline(totalPoints, announcedScore + 1, state),
      )
      expect(errors).toEqual([])
    })
  }
}
