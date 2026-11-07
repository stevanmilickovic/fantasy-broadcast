import { expect, test } from '@playwright/test'
import { mockApp } from './fixtures'

test('clearing a submitted search updates the URL immediately and stays empty after reload', async ({
  page,
}) => {
  await mockApp(page)
  await page.goto('/leagues/new?search=Sunday&page=1')
  await expect(page).toHaveURL('/leagues/find?search=Sunday&page=1')
  const search = page.getByRole('searchbox', { name: 'League name or ID' })
  await expect(search).toHaveValue('Sunday')
  await search.fill('')
  await expect(page).toHaveURL('/leagues/find')
  await expect(search).toBeFocused()
  await page.reload()
  await expect(search).toHaveValue('')
  await search.fill('Another')
  await search.press('Enter')
  await expect(page).toHaveURL('/leagues/find?search=Another&page=0')
  await page.goBack()
  await expect(search).toHaveValue('')
  await page.goForward()
  await expect(search).toHaveValue('Another')
})

test('Find leagues opens only discovery and does not depend on registration access', async ({
  page,
}) => {
  await mockApp(page)
  await page.route('**/api/customer/league-registration', (route) =>
    route.fulfill({ status: 503, json: { message: 'Registration unavailable' } }),
  )
  await page.goto('/league?leagueId=1')
  await page.getByLabel('Account menu').click()
  await page.getByRole('button', { name: 'Find leagues', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Find leagues', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Register a league', exact: true })).toHaveCount(0)
  await expect(page.getByLabel('League name or ID')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeEnabled()
  const bounds = await page.getByLabel('League name or ID').boundingBox()
  expect(bounds?.y).toBeLessThan(420)
})

test('a search can be cleared while its old request is in flight', async ({ page }) => {
  await mockApp(page)
  let release: (() => void) | undefined
  await page.route('**/api/customer/leagues/search?**', async (route) => {
    if (new URL(route.request().url()).searchParams.get('query') === 'Waiting') {
      await new Promise<void>((resolve) => {
        release = resolve
      })
    }
    await route.fulfill({ json: { items: [], page: 0, size: 10, totalItems: 0 } }).catch(() => {})
  })
  await page.goto('/leagues/find')
  const search = page.getByLabel('League name or ID')
  await search.fill('Waiting')
  await search.press('Enter')
  await expect.poll(() => Boolean(release)).toBe(true)
  await search.fill('')
  release?.()
  await expect(page).toHaveURL('/leagues/find')
  await expect(search).toHaveValue('')
  await page.reload()
  await expect(search).toHaveValue('')
})
