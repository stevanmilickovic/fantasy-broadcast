import { expect, test } from '@playwright/test'
import { leagues, mockApp, viewer } from './fixtures'

test('owner approval moves a private follow request into accessible leagues', async ({
  page,
  context,
}) => {
  const owner = await context.newPage()
  await mockApp(page)
  await mockApp(owner)
  const league = { ...leagues[0], privateLeague: true }
  let pending = false
  let approved = false
  const applicant = {
    ...viewer,
    id: 20,
    displayName: 'Applicant with a longer display name',
    email: 'a.long.applicant.email.address.for.mobile@example.com',
  }
  const request = {
    userId: applicant.id,
    leagueId: league.id,
    leagueName: league.displayName,
    displayName: applicant.displayName,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  }
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/me') return route.fulfill({ json: applicant })
    if (path === '/api/customer/leagues') return route.fulfill({ json: approved ? [league] : [] })
    if (path === '/api/customer/leagues/search')
      return route.fulfill({ json: { items: [league], page: 0, size: 10, totalItems: 1 } })
    if (path === '/api/customer/follow-requests')
      return route.fulfill({ json: pending ? [request] : [] })
    if (path.endsWith('/follow')) {
      pending = true
      return route.fulfill({ json: { league, status: 'PENDING' } })
    }
    return route.fallback()
  })
  await owner.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/customer/leagues') return route.fulfill({ json: [league] })
    if (path.endsWith('/follow-requests')) return route.fulfill({ json: pending ? [request] : [] })
    if (path.endsWith(`/follow-requests/${applicant.id}`)) {
      pending = false
      approved = true
      return route.fulfill({ status: 204 })
    }
    if (path.endsWith('/privacy')) {
      league.privateLeague = route.request().postDataJSON().privateLeague
      return route.fulfill({ status: 204 })
    }
    return route.fallback()
  })
  await page.goto('/leagues/new')
  await page.getByRole('textbox', { name: 'League name or ID' }).fill('Sunday')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.getByRole('button', { name: 'Request to follow', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pending approval' })).toBeDisabled()
  await expect(page.getByRole('region', { name: 'Your follow requests' })).toHaveCount(0)
  await expect(page).toHaveURL('/leagues/new?search=Sunday&page=0')
  await owner.goto(`/league?leagueId=${league.id}`)
  await expect(owner.getByRole('status', { name: '1 pending follow request' })).toHaveText('1')
  await expect(owner.getByRole('switch', { name: 'Private league' })).toHaveCount(0)
  await owner.getByLabel('League actions').click()
  await owner.getByRole('button', { name: 'League management', exact: true }).click()
  await expect(owner).toHaveURL(`/league/manage?leagueId=${league.id}`)
  await expect(owner.getByRole('heading', { name: 'League management', exact: true })).toBeVisible()
  const privacy = owner.getByRole('switch', { name: 'Private league', exact: true })
  await expect(privacy).toHaveAttribute('aria-checked', 'true')
  const switchBounds = await privacy.boundingBox()
  expect(switchBounds?.height).toBeGreaterThanOrEqual(44)
  expect(switchBounds?.width).toBeGreaterThanOrEqual(44)
  expect(await owner.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await owner.screenshot({
    path: test.info().outputPath('league-management-pending.png'),
    fullPage: true,
  })
  await owner.getByRole('button', { name: 'Approve', exact: true }).click()
  await expect(owner.getByText('No pending requests.')).toBeVisible()
  await privacy.click()
  await expect(privacy).toHaveAttribute('aria-checked', 'false')
  expect(await owner.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await owner.screenshot({ path: test.info().outputPath('league-management.png'), fullPage: true })
  await owner.getByRole('button', { name: 'Back to league', exact: true }).click()
  await expect(owner.locator('.league-request-badge')).toHaveCount(0)
  await page.goto(`/league?leagueId=${league.id}`)
  await expect(page.getByRole('heading', { name: league.displayName, exact: true })).toBeVisible()
  await expect(page.getByRole('switch', { name: 'Private league' })).toHaveCount(0)
  await page.getByLabel('League actions').click()
  await expect(page.getByRole('button', { name: 'League management', exact: true })).toHaveCount(0)
})
