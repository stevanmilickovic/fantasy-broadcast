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
    if (path.endsWith('/followers'))
      return route.fulfill({
        json: {
          items: approved ? [{ userId: applicant.id, displayName: applicant.displayName }] : [],
          page: 0,
          size: 10,
          totalItems: Number(approved),
        },
      })
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
  await page.goto('/leagues/find')
  await page.getByRole('searchbox', { name: 'League name or ID' }).fill('Sunday')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.getByRole('button', { name: 'Request to follow', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pending approval' })).toBeDisabled()
  await expect(page.getByRole('region', { name: 'Your follow requests' })).toHaveCount(0)
  await expect(page).toHaveURL('/leagues/find?search=Sunday&page=0')
  await owner.goto(`/league?leagueId=${league.id}`)
  await expect(owner.getByRole('status', { name: '1 pending follow request' })).toHaveText('1')
  await expect(owner.getByRole('switch', { name: 'Private league' })).toHaveCount(0)
  await owner.getByLabel('League actions').click()
  await owner.getByRole('button', { name: 'League management', exact: true }).click()
  await expect(owner).toHaveURL(`/league/manage?leagueId=${league.id}`)
  await expect(owner.getByRole('heading', { name: 'League management', exact: true })).toBeVisible()
  const privacy = owner.getByRole('switch', { name: 'Private league', exact: true })
  await expect(privacy).toHaveAttribute('aria-checked', 'true')
  await expect(owner.getByText('No followers yet.')).toBeVisible()
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
  await expect(owner.getByRole('region', { name: 'Followers (1)' })).toContainText(
    applicant.displayName,
  )
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

test('site admins can page through and remove public league followers', async ({ page }) => {
  const { errors, unexpectedRequests } = await mockApp(page, { ...viewer, id: 99, role: 'ADMIN' })
  const league = leagues[0]
  let followers = Array.from({ length: 11 }, (_, index) => ({
    userId: index + 100,
    displayName: `Follower ${index + 1}`,
  }))
  const lastFollower = followers[10]
  const removed: number[] = []
  await page.route(`**/api/customer/leagues/${league.id}/followers**`, (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (request.method() === 'DELETE') {
      const userId = Number(url.pathname.split('/').at(-1))
      removed.push(userId)
      followers = followers.filter((follower) => follower.userId !== userId)
      return route.fulfill({ status: 204 })
    }
    const size = 10
    const currentPage = Math.min(
      Number(url.searchParams.get('page')),
      Math.floor((followers.length - 1) / size),
    )
    return route.fulfill({
      json: {
        items: followers.slice(currentPage * size, (currentPage + 1) * size),
        page: currentPage,
        size,
        totalItems: followers.length,
      },
    })
  })

  await page.goto(`/league/manage?leagueId=${league.id}`)
  await expect(page.getByRole('switch', { name: 'Private league' })).toHaveAttribute(
    'aria-checked',
    'false',
  )
  const list = page.getByRole('region', { name: /^Followers/ })
  await expect(list.getByRole('listitem')).toHaveCount(10)
  await list.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(list.getByText('Page 2 of 2', { exact: false })).toBeVisible()
  const remove = list.getByRole('button', {
    name: `Remove ${lastFollower.displayName} (#${lastFollower.userId})`,
  })
  page.once('dialog', (dialog) => dialog.dismiss())
  await remove.click()
  await expect(remove).toBeVisible()
  expect(removed).toEqual([])
  page.once('dialog', (dialog) => dialog.accept())
  await remove.click()
  await expect(list.getByRole('heading', { name: 'Followers (10)' })).toBeFocused()
  await expect(list.getByRole('listitem')).toHaveCount(10)
  await expect(list.getByRole('navigation')).toHaveCount(0)
  await expect(remove).toHaveCount(0)
  expect(removed).toEqual([lastFollower.userId])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
  expect(unexpectedRequests).toEqual([])
})
