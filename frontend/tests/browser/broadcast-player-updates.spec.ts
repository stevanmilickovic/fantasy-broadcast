import { expect, test } from '@playwright/test'
import { mockBroadcast } from './broadcastFixtures'
import { mockApp } from './fixtures'
import { welcomeBroadcastState } from '../../src/features/public/welcomeDemoData'

for (const totalPoints of [false, true]) {
  test(`${totalPoints ? 'total-points' : 'H2H'} broadcasts use goalkeeper kits and truncate grouped labels before the points`, async ({
    page,
  }) => {
    const { state } = await mockBroadcast(page, totalPoints, (state) => {
      const event = state.events[0]
      state.events = [
        'BONUS',
        'ASSIST',
        'CLEAN_SHEET',
        'APPEARANCE',
        'PENALTY_SAVED',
        'DEFENSIVE_CONTRIBUTION',
        'GOAL',
      ].map((type, index) => ({
        ...event,
        id: `${event.id}-${index}`,
        type,
        pointDelta: index === 0 ? 2 : 1,
      }))
    })
    await page.clock.install()
    await page.goto('/broadcast?leagueId=1')
    await expect(page.locator('.broadcast-scene')).toHaveAttribute('data-phase', 'idle')
    const team = state.teams[0]
    for (const player of [...team.activePlayers, ...team.benchPlayers]) {
      const shirt = page.locator(
        `.broadcast-player[data-manager-id="${team.managerId}"][data-player-id="${player.id}"] .broadcast-shirt img`,
      )
      if (player.position === 'GKP') await expect(shirt).toHaveAttribute('src', /_1-110\.png$/)
      else await expect(shirt).toHaveAttribute('src', /shirt_\d+-110\.png$/)
    }
    const event = state.events[0]
    const panel = page.locator(
      `.broadcast-player[data-manager-id="${event.managerId}"][data-player-id="${event.playerId}"] .broadcast-player-event`,
    )
    await expect(panel).toHaveCSS('opacity', '1')
    await expect(panel.locator('span')).toHaveText(
      'BONUS, ASSIST, CLEAN SHEET, APPEARANCE, PENALTY SAVED, DEFENSIVE CONTRIBUTION, GOAL',
    )
    await expect(panel.locator('b')).toHaveText('+8 pts')
    await expect(panel.locator('small')).toHaveCount(0)
    const fit = await panel.evaluate((node) => {
      const label = node.querySelector('span')!
      const points = node.querySelector('b')!
      return {
        labelRight: label.getBoundingClientRect().right,
        pointsLeft: points.getBoundingClientRect().left,
        pointsRight: points.getBoundingClientRect().right,
        panelRight: node.getBoundingClientRect().right,
        ellipsis: getComputedStyle(label).textOverflow,
        clipped: label.scrollWidth > label.clientWidth,
      }
    })
    expect(fit.ellipsis).toBe('ellipsis')
    if (!totalPoints) expect(fit.clipped).toBe(true)
    expect(fit.labelRight).toBeLessThanOrEqual(fit.pointsLeft)
    expect(fit.pointsRight).toBeLessThanOrEqual(fit.panelRight)
    await page.screenshot({
      path: test.info().outputPath('grouped-notifications.png'),
      fullPage: true,
    })
  })
}

test('league teams use goalkeeper jerseys for starters and bench keepers', async ({ page }) => {
  await mockApp(page)
  await page.goto('/league?leagueId=1&view=teams&entryId=1')
  const team = welcomeBroadcastState(0).teams[0]
  for (const player of [...team.activePlayers, ...team.benchPlayers]) {
    const shirt = page
      .getByRole('button', { name: `View ${player.displayName} points`, exact: true })
      .locator('img')
    if (player.position === 'GKP') await expect(shirt).toHaveAttribute('src', /_1-110\.png$/)
    else await expect(shirt).toHaveAttribute('src', /shirt_\d+-110\.png$/)
  }
})
