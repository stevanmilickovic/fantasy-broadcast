import { expect, test } from '@playwright/test'
import { mockBroadcast } from './broadcastFixtures'

test('event light stays on metadata and jersey, and jerseys grow with desktop space', async ({
  page,
}) => {
  const { state } = await mockBroadcast(page)
  await page.goto('/broadcast?leagueId=1')
  await expect(page.locator('.broadcast-scene')).toHaveAttribute('data-phase', 'idle')
  const event = state.events[0]
  const player = page.locator(
    `.broadcast-player[data-manager-id="${event.managerId}"][data-player-id="${event.playerId}"]`,
  )
  await expect(player).toHaveClass(/has-event/)
  const style = await player.evaluate((node) => {
    const metadata = node.querySelector('.broadcast-player-main')
    const shirt = node.querySelector('.broadcast-shirt')
    const shape = shirt?.querySelector('img,svg')
    if (!metadata || !shirt || !shape) throw new Error('Missing player elements')
    return {
      background: getComputedStyle(node).backgroundColor,
      metadata: getComputedStyle(metadata).boxShadow,
      jersey: getComputedStyle(shape).filter,
      shirtHeight: shirt.getBoundingClientRect().height,
    }
  })
  expect(style.background).toBe('rgba(0, 0, 0, 0)')
  expect(style.metadata).not.toBe('none')
  expect(style.jersey).toContain('drop-shadow')
  const viewport = page.viewportSize()!
  if (viewport.width === 1920) expect(style.shirtHeight).toBeGreaterThan(90)
  if (viewport.width === 390 || viewport.width === 820) expect(style.shirtHeight).toBe(20)
  await page.screenshot({ path: test.info().outputPath('player-polish.png'), fullPage: true })
})

test('the first transition stage alternates brand and league titles', async ({ page }) => {
  await mockBroadcast(page)
  await page.clock.install()
  await page.goto('/broadcast?leagueId=1')
  const scene = page.locator('.broadcast-scene')
  const title = page.locator('.broadcast-wipe-title')
  await expect(scene).toHaveAttribute('data-motion', 'introducing')
  await expect(title).toHaveText('Fantasy Broadcast')
  await expect(scene).toHaveAttribute('data-phase', 'idle')
  await page.clock.fastForward(10_001)
  await page.clock.fastForward(60_000)
  await expect(scene).toHaveAttribute('data-motion', 'introducing')
  await expect(title).toHaveText('Sunday League Elite')
  await expect(scene).toHaveAttribute('data-phase', 'idle')
  await page.clock.fastForward(60_000)
  await expect(scene).toHaveAttribute('data-motion', 'introducing')
  await expect(title).toHaveText('Fantasy Broadcast')
})
