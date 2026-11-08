import { expect, test } from '@playwright/test'
import { leagues, mockApp } from './fixtures'

test('touch taps activate controls without selecting readable page text', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })
  try {
    const page = await context.newPage()
    await mockApp(page)
    for (const [path, title] of [
      ['/leagues', 'My leagues'],
      ['/leagues/find', 'Find leagues'],
      ['/account', 'Account settings'],
      [`/league?leagueId=${leagues[0].id}`, leagues[0].displayName],
    ]) {
      await page.goto(path)
      const heading = page.getByRole('heading', { name: title, exact: true })
      await heading.tap()
      expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('')
      expect(await heading.evaluate((node) => getComputedStyle(node).userSelect)).not.toBe('none')
    }
    await page.goto('/leagues/find')
    await page.getByRole('searchbox', { name: 'League name or ID' }).tap()
    await page.getByRole('searchbox', { name: 'League name or ID' }).fill('Sunday')
    await page.getByRole('button', { name: 'Search', exact: true }).tap()
    await expect(page).toHaveURL('/leagues/find?search=Sunday&page=0')
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('')
  } finally {
    await context.close()
  }
})
