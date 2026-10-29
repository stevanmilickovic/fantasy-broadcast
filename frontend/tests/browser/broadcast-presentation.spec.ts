import { expect, test } from '@playwright/test'
import { mockBroadcast } from './broadcastFixtures'

test('the layered wipe spans the entire live view and uses different piece timings', async ({
  page,
}) => {
  await mockBroadcast(page)
  await page.goto('/broadcast?leagueId=1')
  await expect(page.locator('.broadcast-view')).toHaveAttribute('data-motion', 'introducing')
  await expect
    .poll(() =>
      page
        .locator('.broadcast-wipe i')
        .evaluateAll((pieces) => pieces.every((piece) => piece.getAnimations().length > 0)),
    )
    .toBe(true)
  const coverage = await page.locator('.broadcast-wipe').evaluate((wipe) => {
    const effect = wipe.getAnimations().at(-1)
    if (!effect) throw new Error('Missing fullscreen wipe')
    effect.pause()
    effect.currentTime = 0
    const rect = wipe.getBoundingClientRect()
    const durations = [...wipe.querySelectorAll('i')].map(
      (piece) => piece.getAnimations()[0]?.effect?.getTiming().duration,
    )
    effect.play()
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      durations,
      border: getComputedStyle(wipe).borderRightWidth,
    }
  })
  const viewport = page.viewportSize()!
  expect(Math.abs(coverage.left)).toBeLessThanOrEqual(1)
  expect(Math.abs(coverage.top)).toBeLessThanOrEqual(1)
  expect(coverage.width).toBe(viewport.width)
  expect(coverage.height).toBe(viewport.height)
  expect(coverage.durations).toHaveLength(3)
  expect(new Set(coverage.durations).size).toBe(3)
  expect(coverage.border).toBe('0px')
})

test('player point changes expand below the name without moving the squad rows', async ({
  page,
}) => {
  const { state } = await mockBroadcast(page)
  await page.clock.install()
  await page.goto('/broadcast?leagueId=1')
  await expect(page.locator('.broadcast-scene')).toHaveAttribute('data-motion', 'introducing')
  const event = state.events[0]
  const player = page.locator(
    `.broadcast-player[data-manager-id="${event.managerId}"][data-player-id="${event.playerId}"]`,
  )
  const before = await player.boundingBox()
  const name = player.locator('.broadcast-player-name')
  const beforeName = await name.boundingBox()
  await expect(page.locator('.broadcast-scene')).toHaveAttribute('data-phase', 'idle')
  await expect(player).toHaveClass(/has-event/)
  const panel = player.locator('.broadcast-player-event')
  await expect(panel).toContainText('GOAL')
  await expect(panel).toContainText('+5 pts')
  await expect(panel).toHaveCSS('opacity', '1')
  const after = await player.boundingBox()
  expect(after?.y).toBe(before?.y)
  expect(after?.height).toBe(before?.height)
  const metadata = await name.boundingBox()
  const compact = await player
    .locator('.broadcast-player-main')
    .evaluate(
      (node) =>
        getComputedStyle(node).getPropertyValue('--broadcast-player-event-height').trim() !== '',
    )
  if (compact) expect(metadata?.y).toBeLessThan((beforeName?.y ?? 0) - 4)
  const notification = await panel.boundingBox()
  expect(notification?.y).toBeGreaterThanOrEqual((metadata?.y ?? 0) + (metadata?.height ?? 0) - 1)
  await page.screenshot({ path: test.info().outputPath('player-event.png'), fullPage: true })
  await page.clock.fastForward(10_001)
  await expect(player).not.toHaveClass(/has-event/)
  const restored = await name.boundingBox()
  expect(Math.abs((restored?.y ?? 0) - (beforeName?.y ?? 0))).toBeLessThanOrEqual(1)
  expect((await player.boundingBox())?.height).toBe(before?.height)
})

for (const totalPoints of [false, true]) {
  test(`${totalPoints ? 'total-points' : 'H2H'} idle return introduces the current score without replaying the last delta`, async ({
    page,
  }) => {
    await mockBroadcast(page, totalPoints, (state) => {
      if (totalPoints) state.teams = state.teams.slice(0, 2)
    })
    await page.clock.install()
    await page.goto('/broadcast?leagueId=1')
    const scene = page.locator('.broadcast-scene')
    await expect(scene).toHaveAttribute('data-phase', 'idle')
    await page.clock.fastForward(10_001)
    for (let rotation = 0; rotation < 2; rotation++) {
      await page.clock.fastForward(60_000)
      await expect(scene).toHaveAttribute('data-motion', 'introducing')
      const expected = totalPoints
        ? rotation === 0
          ? '49pts'
          : '53pts'
        : rotation === 0
          ? '43–45'
          : '53–49'
      await expect(page.locator('.broadcast-score')).toHaveText(expected)
      await expect(scene).toHaveAttribute('data-phase', 'idle')
      await expect(page.locator('.broadcast-score')).toHaveText(expected)
    }
    await expect(page.locator('.broadcast-player.has-event')).toHaveCount(0)
  })
}
