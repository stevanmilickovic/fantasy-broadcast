import { expect, test } from '@playwright/test'
import { leagues, mockApp } from './fixtures'

test('long league names wrap beside distinct follow request pending and open actions', async ({
  page,
}, info) => {
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
  await expect(page.getByRole('button', { name: 'Pending approval', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Pending approval', exact: true })).toHaveCSS(
    'opacity',
    '1',
  )
  await expect(page.getByRole('button', { name: 'Follow', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Request to follow', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Request again', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Open league', exact: true })).toBeEnabled()
  const widths = info.project.name === 'phone' ? [320, 360, 390] : [page.viewportSize()!.width]
  for (const width of widths) {
    await page.setViewportSize({ width, height: page.viewportSize()!.height })
    const boxes = await page.locator('.league-search-result').evaluateAll((rows) =>
      rows.map((row) => {
        const name = row.querySelector(':scope > span')!.getBoundingClientRect()
        const button = row.querySelector('button')!.getBoundingClientRect()
        const result = row.getBoundingClientRect()
        return {
          nameRight: name.right,
          nameHeight: name.height,
          actionLeft: button.left,
          actionRight: button.right,
          actionHeight: button.height,
          resultRight: result.right,
        }
      }),
    )
    for (const box of boxes) {
      expect(box.nameRight).toBeLessThan(box.actionLeft)
      expect(Math.abs(box.actionRight - box.resultRight)).toBeLessThanOrEqual(1)
      expect(box.actionHeight).toBeGreaterThanOrEqual(44)
      if (width < 400) expect(box.nameHeight).toBeGreaterThan(44)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  const styles = await page.locator('.league-result-action').evaluateAll((buttons) =>
    buttons.slice(0, 4).map((button) => {
      const style = getComputedStyle(button)
      return [style.backgroundColor, style.borderColor, style.color].join('|')
    }),
  )
  expect(new Set(styles).size).toBe(4)
  await page.screenshot({
    path: test.info().outputPath('discovery-action-states.png'),
    fullPage: true,
  })
})
