import { expect, test } from '@playwright/test'
import { leagues, mockApp, viewer } from './fixtures'

test('registered leagues browse pages, reset search, retain history and recover errors', async ({
  page,
}) => {
  const { errors, unexpectedRequests } = await mockApp(page)
  let fail = false
  await page.route('**/api/customer/leagues/search?**', (route) => {
    const params = new URL(route.request().url()).searchParams
    const index = Number(params.get('page'))
    const search = params.get('query') ?? ''
    if (fail) return route.fulfill({ status: 503, json: { detail: 'Directory unavailable' } })
    const items = search
      ? []
      : Array.from({ length: index === 0 ? 10 : 1 }, (_, i) => ({
          ...leagues[0],
          id: index * 10 + i + 1,
          displayName: `Registered league ${index * 10 + i + 1} with a long name that wraps gracefully`,
        }))
    return route.fulfill({ json: { items, page: index, size: 10, totalItems: search ? 0 : 11 } })
  })
  await page.goto('/leagues/find')
  const pagination = page.getByRole('navigation', { name: 'Registered league pages' })
  await expect(page.getByText('Registered league 1 with', { exact: false })).toBeVisible()
  await expect(pagination.getByRole('button', { name: 'Previous' })).toBeDisabled()
  await pagination.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText('Registered league 11 with', { exact: false })).toBeVisible()
  await expect(pagination).toContainText('Page 2 of 2')
  await expect(pagination.getByRole('button', { name: 'Next' })).toBeDisabled()
  await page.reload()
  await expect(pagination).toContainText('Page 2 of 2')
  await page.getByLabel('League name or ID').fill('missing')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(page.getByText('No leagues match this search.')).toBeVisible()
  await expect(pagination).toHaveCount(0)
  await page.goBack()
  await expect(pagination).toContainText('Page 2 of 2')
  await expect(page.getByLabel('League name or ID')).toHaveValue('')
  fail = true
  await pagination.getByRole('button', { name: 'Previous' }).click()
  await expect(page.getByRole('alert')).toContainText('Directory unavailable')
  fail = false
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(pagination).toContainText('Page 1 of 2')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({
    path: test.info().outputPath('registered-directory.png'),
    fullPage: true,
  })
  expect(errors).toEqual([])
  expect(unexpectedRequests).toEqual([])
})

test('subscription administration pages all results and resets search', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Administration targets desktop operators.')
  const { errors, unexpectedRequests } = await mockApp(page, { ...viewer, role: 'ADMIN' })
  await page.route('**/api/customer/admin/subscriptions?**', (route) => {
    const params = new URL(route.request().url()).searchParams
    const index = Number(params.get('page'))
    const search = params.get('search') ?? ''
    return route.fulfill({
      json: {
        items: [
          {
            id: `sub_${index}`,
            leagueId: 1,
            leagueName: `Billing league ${index + 1}`,
            ownerName: `${viewer.displayName} (#${viewer.id})`,
            plan: 'STANDARD',
            status: 'active',
            periodEnd: null,
          },
        ],
        page: index,
        size: 10,
        totalItems: search ? 1 : 11,
      },
    })
  })
  await page.goto('/administration')
  const billing = page.getByRole('region', { name: 'Subscriptions and refunds' })
  const pagination = billing.getByRole('navigation', { name: 'Subscription pages' })
  await expect(pagination.getByRole('button', { name: 'Previous' })).toBeDisabled()
  await pagination.getByRole('button', { name: 'Next' }).click()
  await expect(billing.getByRole('button', { name: /Billing league 2/ })).toBeVisible()
  await expect(pagination.getByRole('button', { name: 'Next' })).toBeDisabled()
  await page.reload()
  await expect(pagination).toContainText('Page 2 of 2')
  await billing
    .getByLabel('League, FPL ID, owner username or payment/subscription ID')
    .fill('specific')
  await billing.getByRole('button', { name: 'Find subscriptions' }).click()
  await expect(pagination).toHaveCount(0)
  await expect(billing.getByRole('button', { name: /Billing league 1/ })).toBeVisible()
  expect(errors).toEqual([])
  expect(unexpectedRequests).toEqual([])
})

test('followed leagues show Open league instead of Follow, including after a new follow', async ({
  page,
}) => {
  const { errors, unexpectedRequests } = await mockApp(page)
  const existing = { ...leagues[0], ownerUserId: 99 }
  const target = { ...leagues[1], id: 3, displayName: 'A league to follow', ownerUserId: 99 }
  let followed = false
  let submissions = 0
  await page.route('**/api/customer/leagues', (route) =>
    route.fulfill({ json: followed ? [existing, target] : [existing] }),
  )
  await page.route('**/api/customer/leagues/search?**', (route) =>
    route.fulfill({ json: { items: [existing, target], page: 0, size: 10, totalItems: 2 } }),
  )
  await page.route('**/api/customer/leagues/3/follow', (route) => {
    submissions++
    followed = true
    return route.fulfill({ json: { league: target, status: 'APPROVED' } })
  })
  await page.goto('/leagues/find')
  const existingRow = page
    .locator('.league-search-result')
    .filter({ hasText: existing.displayName })
  await expect(existingRow.getByRole('button', { name: 'Follow', exact: true })).toHaveCount(0)
  await existingRow.getByRole('link', { name: 'Open league', exact: true }).click()
  await expect(page).toHaveURL('/league?leagueId=1')
  expect(submissions).toBe(0)
  await page.goto('/leagues/find')
  const targetRow = page.locator('.league-search-result').filter({ hasText: target.displayName })
  await targetRow.getByRole('button', { name: 'Follow', exact: true }).click()
  await expect(page).toHaveURL('/league?leagueId=3')
  await page.goto('/leagues/find')
  await expect(targetRow.getByRole('link', { name: 'Open league', exact: true })).toBeVisible()
  await expect(targetRow.getByRole('button', { name: 'Follow', exact: true })).toHaveCount(0)
  expect(submissions).toBe(1)
  expect(errors).toEqual([])
  expect(unexpectedRequests).toEqual([])
})
