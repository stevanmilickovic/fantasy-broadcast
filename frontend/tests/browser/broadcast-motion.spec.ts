import { expect, test } from '@playwright/test'
import { mockBroadcast } from './broadcastFixtures'

for (const totalPoints of [false, true]) {
  test(`${totalPoints ? 'total-points' : 'H2H'} real text holds, flies directly and lands without a handoff`, async ({
    page,
  }) => {
    const { errors } = await mockBroadcast(page, totalPoints)
    await page.goto('/broadcast?leagueId=1')
    const scene = page.locator('.broadcast-scene')
    await expect(scene).toHaveAttribute('data-motion', 'introducing')
    const saved = await scene.evaluateHandle((root) => {
      const nodes = [...root.querySelectorAll<HTMLElement>('[data-reveal-role]')]
      const effects = nodes.flatMap((node) => node.getAnimations())
      const slots = [...root.querySelectorAll<HTMLElement>('[data-intro-slot]')]
      const stacked = slots.length > 1 && Math.abs(slots[0].offsetTop - slots[1].offsetTop) > 1
      const destinations = nodes.map((node) => {
        const effect = node.getAnimations()[0]
        if (!effect) throw new Error('Missing actual-node flight')
        const savedTime = effect.currentTime
        effect.currentTime = 780
        const rect = node.getBoundingClientRect().toJSON()
        effect.currentTime = savedTime
        return rect
      })
      return { nodes, effects, destinations, stacked }
    })
    await expect(scene).toHaveAttribute('data-motion', 'landing')
    for (const progress of [0, 0.2, 0.4, 0.6, 0.8, 0.99]) {
      const metrics = await saved.evaluate(
        ({ nodes, effects, destinations, stacked }, fraction) => {
          effects.forEach((effect) => {
            effect.pause()
            effect.currentTime = 780 * fraction
          })
          const rects = nodes.map((node) => node.getBoundingClientRect())
          const root = nodes[0].closest('.broadcast-scene')!.getBoundingClientRect()
          return {
            same: nodes.every((node) => node.isConnected),
            direct: effects.every(
              (effect) =>
                effect.effect instanceof KeyframeEffect &&
                effect.effect.getKeyframes().length === 2,
            ),
            stacked,
            inside: rects.every(
              (rect) =>
                rect.left >= root.left - 1 &&
                rect.right <= root.right + 1 &&
                rect.top >= root.top - 1 &&
                rect.bottom <= root.bottom + 1,
            ),
            overlaps: rects.some((a, i) =>
              rects
                .slice(i + 1)
                .some(
                  (b) =>
                    a.left < b.right - 1 &&
                    a.right > b.left + 1 &&
                    a.top < b.bottom - 1 &&
                    a.bottom > b.top + 1,
                ),
            ),
            grows: rects.some((rect, i) => rect.width > destinations[i].width * 1.2),
          }
        },
        progress,
      )
      expect(metrics.same).toBe(true)
      expect(metrics.inside).toBe(true)
      expect(metrics.direct).toBe(true)
      if (!metrics.stacked) expect(metrics.overlaps).toBe(false)
      if (progress === 0) expect(metrics.grows).toBe(true)
    }
    const landing = await saved.evaluate(({ nodes, effects, destinations }) => {
      effects.forEach((effect) => {
        effect.finish()
      })
      return nodes.map((node, i) => ({
        actual: node.getBoundingClientRect().toJSON(),
        expected: destinations[i],
      }))
    })
    for (const { actual, expected } of landing) {
      expect(Math.abs(actual.left - expected.left)).toBeLessThanOrEqual(1)
      expect(Math.abs(actual.top - expected.top)).toBeLessThanOrEqual(1)
    }
    await expect(scene).toHaveAttribute('data-phase', 'idle')
    const cleanup = await saved.evaluate(({ nodes, destinations }) =>
      nodes.map((node, i) => ({
        connected: node.isConnected,
        effects: node.getAnimations().length,
        left: node.getBoundingClientRect().left,
        expected: destinations[i].left,
      })),
    )
    for (const item of cleanup) {
      expect(item.connected).toBe(true)
      expect(item.effects).toBe(0)
      expect(Math.abs(item.left - item.expected)).toBeLessThanOrEqual(1)
    }
    expect(errors).toEqual([])
    await saved.dispose()
  })
}

test('a phone resize settles the flight without replaying it and reduced motion skips it', async ({
  page,
}) => {
  await mockBroadcast(page)
  await page.goto('/broadcast?leagueId=1')
  const scene = page.locator('.broadcast-scene')
  await expect(scene).toHaveAttribute('data-motion', 'introducing')
  const viewport = page.viewportSize()!
  await page.setViewportSize({ width: viewport.width - 10, height: viewport.height - 10 })
  await expect(scene).toHaveAttribute('data-phase', 'idle')
  expect(
    await scene
      .locator('[data-reveal-role]')
      .evaluateAll((nodes) => nodes.every((node) => node.getAnimations().length === 0)),
  ).toBe(true)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await expect(scene).toHaveAttribute('data-phase', 'idle')
  expect(await scene.evaluate((node) => node.getAnimations({ subtree: true }).length)).toBe(0)
})

test('manual selection cancels an in-flight introduction and keeps controls usable', async ({
  page,
}) => {
  await mockBroadcast(page)
  await page.goto('/broadcast?leagueId=1')
  const scene = page.locator('.broadcast-scene')
  await expect(scene).toHaveAttribute('data-motion', 'introducing')
  const completions = await scene.evaluateHandle((root) =>
    root
      .getAnimations({ subtree: true })
      .filter((effect) => effect.effect?.getTiming().iterations !== Infinity)
      .map((effect) => effect.finished.catch(() => undefined)),
  )
  await page.getByRole('button', { name: 'Multi', exact: true }).click()
  await expect(scene).toHaveAttribute('data-phase', 'idle')
  await completions.evaluate(async (promises) => {
    await Promise.all(promises)
  })
  expect(
    await scene.evaluate(
      (root) =>
        root
          .getAnimations({ subtree: true })
          .filter((effect) => effect.effect?.getTiming().iterations !== Infinity).length,
    ),
  ).toBe(0)
  await page.getByRole('button', { name: 'Standings', exact: true }).click()
  await expect(page.getByRole('columnheader', { name: 'League pts', exact: true })).toBeVisible()
  await completions.dispose()
})

test('homepage demo keeps its actual-node flight inside its own unscaled container after scrolling', async ({
  page,
}, info) => {
  test.skip(
    ['phone', 'phone-landscape', 'tablet'].includes(info.project.name),
    'The public design intentionally hides the demo on narrow screens.',
  )
  await mockBroadcast(page)
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401, json: {} }))
  await page.goto('/')
  const scene = page.locator('.welcome-real-broadcast .broadcast-scene')
  await expect(scene).toHaveAttribute('data-motion', 'introducing')
  await scene.scrollIntoViewIfNeeded()
  expect(
    await scene.evaluate((root) => {
      const bounds = root.getBoundingClientRect()
      return [...root.querySelectorAll('[data-reveal-role]')].every((node) => {
        const rect = node.getBoundingClientRect()
        return (
          rect.left >= bounds.left - 1 &&
          rect.right <= bounds.right + 1 &&
          rect.top >= bounds.top - 1 &&
          rect.bottom <= bounds.bottom + 1
        )
      })
    }),
  ).toBe(true)
  await expect(scene).toHaveAttribute('data-phase', 'idle')
  const demo = page.locator('.welcome-real-broadcast')
  await expect(demo.locator('.broadcast-view')).toHaveAttribute('data-layout', 'desktop')
  await expect(demo.locator('.broadcast-pitch-markings')).toBeVisible()
  expect(
    await demo
      .locator('.broadcast-starters')
      .first()
      .evaluate((node) => getComputedStyle(node).display),
  ).not.toBe('contents')
  expect(await demo.evaluate((node) => getComputedStyle(node).transform)).not.toBe('none')
  await expect(demo.locator('.broadcast-player')).toHaveCount(30)
  expect(
    await demo
      .locator('.broadcast-player')
      .first()
      .evaluate((node) => parseFloat(getComputedStyle(node).fontSize)),
  ).toBe(10)
  expect(
    await demo.evaluate((node) => {
      const frame = node.getBoundingClientRect()
      return [...node.querySelectorAll('.broadcast-player')].every((player) => {
        const rect = player.getBoundingClientRect()
        return (
          rect.left >= frame.left - 1 &&
          rect.right <= frame.right + 1 &&
          rect.top >= frame.top - 1 &&
          rect.bottom <= frame.bottom + 1
        )
      })
    }),
  ).toBe(true)
  await page.screenshot({ path: test.info().outputPath('desktop-demo.png'), fullPage: false })
})
