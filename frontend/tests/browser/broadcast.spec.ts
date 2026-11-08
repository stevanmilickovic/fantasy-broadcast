import { expect, test, type Page } from '@playwright/test'
import { broadcastFixture, mockBroadcast } from './broadcastFixtures'

async function chooseFocus(page: Page, label: string) {
  const picker = page.getByRole('button', { name: /^Choose (match|club)$/ })
  if (await picker.isVisible()) {
    await picker.click()
    await page
      .getByRole('dialog', { name: 'Broadcast focus' })
      .getByRole('button', { name: label })
      .click()
  } else await page.locator('.match-chip-track').getByRole('button', { name: label }).click()
}

for (const totalPoints of [false, true]) {
  test(`${totalPoints ? 'total-points' : 'head-to-head'} broadcast fits full squads and supports manual focus`, async ({
    page,
  }) => {
    const { state, errors } = await mockBroadcast(page, totalPoints)
    await page.goto('/broadcast?leagueId=1')
    const scene = page.locator('.broadcast-scene')
    await expect(scene).toHaveAttribute('data-phase', 'idle')
    await expect(page.getByRole('navigation', { name: /Ongoing .* selector/ })).toBeVisible()
    const metrics = await page.locator('.broadcast-player').evaluateAll((nodes) =>
      nodes.map((node) => {
        const box = node.getBoundingClientRect()
        return {
          id: `${node.getAttribute('data-manager-id')}:${node.getAttribute('data-player-id')}`,
          top: box.top,
          bottom: box.bottom,
          left: box.left,
          right: box.right,
          font: parseFloat(
            getComputedStyle(node.querySelector('.broadcast-player-name')!).fontSize,
          ),
        }
      }),
    )
    expect(metrics).toHaveLength(totalPoints ? 15 : 30)
    expect(new Set(metrics.map((item) => item.id)).size).toBe(metrics.length)
    const viewport = page.viewportSize()!
    for (const item of metrics) {
      expect(item.top).toBeGreaterThanOrEqual(0)
      expect(item.bottom).toBeLessThanOrEqual(viewport.height)
      expect(item.left).toBeGreaterThanOrEqual(0)
      expect(item.right).toBeLessThanOrEqual(viewport.width)
      expect(item.font).toBeGreaterThanOrEqual(12)
    }
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollHeight <= innerHeight &&
          document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    const next = totalPoints ? state.teams[1] : state.matchups[1].home
    await chooseFocus(
      page,
      totalPoints
        ? `${next.clubName} ${next.score} pts`
        : `${next.clubName} · ${state.matchups[1].away.clubName} ${state.matchups[1].scoreline}`,
    )
    await expect(page.getByRole('heading', { name: next.clubName, exact: true })).toBeVisible()
    await expect(scene).toHaveAttribute('data-phase', 'idle')
    expect(errors).toEqual([])
    await page.screenshot({ path: test.info().outputPath('broadcast.png'), fullPage: true })
  })
}

test('streamed updates freeze the outgoing snapshot until the cover commits and close on exit', async ({
  page,
}) => {
  await mockBroadcast(page)
  await page.clock.install()
  await page.goto('/broadcast?leagueId=1')
  const scene = page.locator('.broadcast-scene')
  await expect(scene).toHaveAttribute('data-phase', 'idle')
  await page.clock.runFor(1000)
  await expect(page.locator('.broadcast-score')).toHaveText('53–49')
  await page.evaluate(
    (state) => window.dispatchEvent(new CustomEvent('broadcast-test-update', { detail: state })),
    broadcastFixture(false, 1),
  )
  await expect(page.locator('.broadcast-score')).toHaveText('53–49')
  await page.clock.fastForward(10000)
  await expect(scene).toHaveAttribute('data-phase', 'covering')
  await expect(page.locator('.broadcast-score')).toHaveText('53–49')
  await expect(page.getByRole('heading', { name: 'North Bank FC', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'No Fuchs Given', exact: true })).toBeVisible()
  await expect(scene).toHaveAttribute('data-phase', 'idle')
  await page.clock.runFor(1000)
  await expect(page.locator('.broadcast-score')).toHaveText('46–45')
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page).toHaveURL('/leagues')
  await expect(page.locator('html')).toHaveAttribute('data-broadcast-stream', 'closed')
})
