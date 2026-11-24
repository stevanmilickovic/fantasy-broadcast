import { expect, test } from '@playwright/test'
import { leagues, mockApp } from './fixtures'

test('long league names and actions fit the directory at every width', async ({ page }, info) => {
  await mockApp(page)
  const items = Array.from({ length: 5 }, (_, index) => ({
    ...leagues[0],
    id: 101 + index,
    ownerUserId: 99,
    displayName: `League ${index + 1} ${'AnUnusuallyLongLeagueNameWithoutSpaces'.repeat(3)}`,
    privateLeague: index === 1 || index >= 3,
  }))
  await page.route('**/api/customer/leagues', (route) => route.fulfill({ json: [items[2]] }))
  await page.route('**/api/customer/leagues/search?**', (route) =>
    route.fulfill({ json: { items, page: 0, size: 10, totalItems: 5 } }),
  )
  await page.route('**/api/customer/follow-requests', (route) =>
    route.fulfill({
      json: [
        { userId: 7, leagueId: 104, status: 'PENDING' },
        { userId: 7, leagueId: 105, status: 'REJECTED' },
      ],
    }),
  )
  await page.goto('/leagues/find')
  await expect(page.getByText('Pending approval', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pending approval' })).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: 'Registered league pages' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Follow', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Request to follow', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Request again', exact: true })).toBeEnabled()
  await expect(page.getByRole('link', { name: 'Open league', exact: true })).toHaveAttribute(
    'href',
    '/league?leagueId=103',
  )
  const widths = info.project.name === 'phone' ? [320, 360, 390] : [page.viewportSize()!.width]
  for (const width of widths) {
    await page.setViewportSize({ width, height: page.viewportSize()!.height })
    const boxes = await page.locator('.league-search-result').evaluateAll((rows) =>
      rows.map((row) => {
        const name = row.querySelector(':scope > span')!.getBoundingClientRect()
        const action = row
          .querySelector('.league-result-action, .league-result-pending')!
          .getBoundingClientRect()
        const result = row.getBoundingClientRect()
        return {
          nameRight: name.right,
          nameLeft: name.left,
          nameBottom: name.bottom,
          actionTop: action.top,
          actionLeft: action.left,
          actionRight: action.right,
          actionHeight: action.height,
          resultRight: result.right,
        }
      }),
    )
    for (const box of boxes) {
      expect(box.actionRight).toBeLessThanOrEqual(box.resultRight)
      expect(box.actionHeight).toBeGreaterThanOrEqual(44)
      if (width <= 400) {
        expect(box.actionLeft).toBe(box.nameLeft)
        expect(box.actionTop).toBeGreaterThan(box.nameBottom)
      } else {
        expect(box.actionLeft).toBeGreaterThan(box.nameRight)
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.screenshot({
    path: test.info().outputPath('discovery-action-states.png'),
    fullPage: true,
  })
})
