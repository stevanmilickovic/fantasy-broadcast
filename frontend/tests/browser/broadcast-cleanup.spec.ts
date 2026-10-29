import { expect, test } from '@playwright/test'
import { broadcastFixture, mockBroadcast } from './broadcastFixtures'

test('every transition piece is off screen before the text finishes landing', async ({ page }) => {
  await mockBroadcast(page)
  await page.goto('/broadcast?leagueId=1')
  const frame = page.locator('.broadcast-view')
  await expect(frame).toHaveAttribute('data-motion', 'landing')
  const fragments = await frame.evaluate((root) => {
    const bounds = root.getBoundingClientRect()
    return [...root.querySelectorAll('.broadcast-wipe, .broadcast-wipe i')].some((piece) => {
      const box = piece.getBoundingClientRect()
      return (
        box.left < bounds.right - 0.5 &&
        box.right > bounds.left + 0.5 &&
        box.top < bounds.bottom - 0.5 &&
        box.bottom > bounds.top + 0.5
      )
    })
  })
  expect(fragments).toBe(false)
})

for (const totalPoints of [false, true]) {
  test(`${totalPoints ? 'total-points' : 'H2H'} covers never flash back during initial or automatic reveal cleanup`, async ({
    page,
  }) => {
    await mockBroadcast(page, totalPoints)
    await page.addInitScript(() => {
      const cancel = Animation.prototype.cancel
      Animation.prototype.cancel = function () {
        const target = this.effect instanceof KeyframeEffect ? this.effect.target : null
        const scene =
          target instanceof Element ? target.closest<HTMLElement>('.broadcast-view') : null
        const finishing = scene?.dataset.motion === 'landing' || scene?.dataset.motion === 'settled'
        cancel.call(this)
        if (!scene || !finishing) return
        const bounds = scene.getBoundingClientRect()
        const covered = [
          ...scene.querySelectorAll('.broadcast-wipe, .broadcast-intro-backdrop'),
        ].some((layer) => {
          const style = getComputedStyle(layer)
          const rect = layer.getBoundingClientRect()
          return (
            style.display !== 'none' &&
            Number(style.opacity) > 0.1 &&
            rect.left <= bounds.left + 1 &&
            rect.right >= bounds.right - 1 &&
            rect.top <= bounds.top + 1 &&
            rect.bottom >= bounds.bottom - 1
          )
        })
        const data = document.documentElement.dataset
        data.cleanupSamples = String(Number(data.cleanupSamples ?? 0) + 1)
        if (covered) data.cleanupFlash = 'true'
      }
    })
    await page.clock.install()
    await page.goto('/broadcast?leagueId=1')
    const scene = page.locator('.broadcast-scene')
    await expect(scene).toHaveAttribute('data-phase', 'idle')
    expect(Number(await page.locator('html').getAttribute('data-cleanup-samples'))).toBeGreaterThan(
      0,
    )
    await expect(page.locator('html')).not.toHaveAttribute('data-cleanup-flash')
    await expect(page.locator('.broadcast-score-cell > small')).toHaveCount(0)
    const borders = await page.locator('.broadcast-identity').evaluateAll((nodes) =>
      nodes.map((node) => {
        const style = getComputedStyle(node)
        return [style.borderLeftWidth, style.borderRightWidth]
      }),
    )
    expect(borders.every((widths) => widths.every((width) => width === '0px'))).toBe(true)
    await page.evaluate(
      (state) => window.dispatchEvent(new CustomEvent('broadcast-test-update', { detail: state })),
      broadcastFixture(totalPoints, 1),
    )
    await page.clock.fastForward(10_000)
    await expect(scene).toHaveAttribute('data-phase', 'covering')
    await expect(scene).toHaveAttribute('data-phase', 'idle')
    await expect(page.locator('html')).not.toHaveAttribute('data-cleanup-flash')
  })
}
