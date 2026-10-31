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
  const applicant = { ...viewer, id: 20, displayName: 'Applicant' }
  const request = {
    userId: applicant.id,
    leagueId: league.id,
    leagueName: league.displayName,
    displayName: applicant.displayName,
    email: applicant.email,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  }
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/me') return route.fulfill({ json: applicant })
    if (path === '/api/customer/leagues') return route.fulfill({ json: approved ? [league] : [] })
    if (path === '/api/customer/leagues/search') return route.fulfill({ json: [league] })
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
    return route.fallback()
  })
  await page.goto('/leagues/new')
  await page.getByRole('textbox', { name: 'League name or ID' }).fill('Sunday')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.getByRole('button', { name: 'Request to follow', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pending approval' })).toBeDisabled()
  await expect(page.getByText('Awaiting owner approval')).toBeVisible()
  await expect(page).toHaveURL('/leagues/new')
  await owner.goto(`/league?leagueId=${league.id}`)
  await owner.getByText('Privacy and follow requests', { exact: true }).click()
  await owner.getByRole('button', { name: 'Approve', exact: true }).click()
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByText('No outstanding requests.')).toBeVisible()
  await page.goto(`/league?leagueId=${league.id}`)
  await expect(page.getByRole('heading', { name: league.displayName, exact: true })).toBeVisible()
  await expect(page.getByText('Privacy and follow requests', { exact: true })).toHaveCount(0)
})
