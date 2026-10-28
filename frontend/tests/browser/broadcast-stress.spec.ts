import { expect, test } from '@playwright/test'
import { mockBroadcast } from './broadcastFixtures'

for (const [width, height] of [
  [360, 640],
  [375, 667],
  [430, 932],
  [667, 375],
]) {
  test(`full H2H squads fit ${width} by ${height} with long names`, async ({ page }, info) => {
    test.skip(info.project.name !== 'phone', 'Fixed-size stress cases run once.')
    await page.setViewportSize({ width, height })
    await mockBroadcast(page, false, (state) => {
      state.teams[0].clubName = 'The extraordinarily long North Bank Football Club'
      state.teams[1].clubName = 'Expected Toulouse International Football Association'
    })
    await page.goto('/broadcast?leagueId=1')
    await expect(page.locator('.broadcast-scene')).toHaveAttribute('data-phase', 'idle')
    const fit = await page.locator('.broadcast-player').evaluateAll((nodes) => {
      const rects = nodes.map((node) => node.getBoundingClientRect())
      const rail = document.querySelector('.broadcast-event-rail')!.getBoundingClientRect()
      return {
        count: nodes.length,
        inside: rects.every(
          (r) => r.top >= 0 && r.bottom <= rail.top && r.left >= 0 && r.right <= innerWidth,
        ),
        overlap: rects.some((a, i) =>
          rects
            .slice(i + 1)
            .some(
              (b) =>
                a.left < b.right - 0.5 &&
                a.right > b.left + 0.5 &&
                a.top < b.bottom - 0.5 &&
                a.bottom > b.top + 0.5,
            ),
        ),
        scroll: document.documentElement.scrollHeight > innerHeight,
      }
    })
    expect(fit).toEqual({ count: 30, inside: true, overlap: false, scroll: false })
  })
}

test('standings exposes every club with correct metrics and player details retain league context', async ({
  page,
}) => {
  await mockBroadcast(page, false, (state) => {
    state.standings = Array.from({ length: 25 }, (_, i) => ({
      teamId: `club-${i}`,
      teamName: `Club ${i + 1}`,
      managerName: `Manager ${i + 1}`,
      position: i + 1,
      total: 70 - i,
      gameweekPoints: 50 - i,
      pointsFor: 1000 - i,
    }))
  })
  await page.goto('/broadcast?leagueId=1')
  await expect(page.locator('.broadcast-scene')).toHaveAttribute('data-phase', 'idle')
  const player = page.getByRole('button', { name: 'View Saka points' }).first()
  const request = page.waitForRequest(
    (request) =>
      request.url().includes('/api/customer/leagues/1/players/') &&
      request.url().includes('gameweek=24'),
  )
  await player.click()
  await request
  await expect(page.getByRole('heading', { name: 'Player details in this league' })).toBeVisible()
  await page.getByRole('button', { name: 'Close player details' }).click()
  await expect(player).toBeFocused()
  await page.getByRole('button', { name: 'Standings', exact: true }).click()
  await expect(page.getByRole('columnheader', { name: 'League pts', exact: true })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'GW pts', exact: true })).toBeVisible()
  await expect(page.locator('.broadcast-standings tbody tr')).toHaveCount(25)
  await page.getByRole('rowheader', { name: 'Club 25 Manager 25' }).scrollIntoViewIfNeeded()
  await expect(page.getByRole('rowheader', { name: 'Club 25 Manager 25' })).toBeVisible()
})

test('shared Classic players highlight only the owning club and events do not move rows', async ({
  page,
}) => {
  const { state } = await mockBroadcast(page)
  await page.goto('/broadcast?leagueId=1')
  await expect(page.locator('.broadcast-scene')).toHaveAttribute('data-phase', 'idle')
  const playerId = state.events[0].playerId
  const own = page.locator(
    `.broadcast-player[data-manager-id="${state.events[0].managerId}"][data-player-id="${playerId}"]`,
  )
  await expect(own).toHaveClass(/has-event/)
  await expect(
    page.locator(
      `.broadcast-player[data-manager-id="${state.teams[1].managerId}"][data-player-id="${playerId}"]`,
    ),
  ).not.toHaveClass(/has-event/)
  expect(await page.locator('.broadcast-player.has-event').count()).toBe(1)
})
