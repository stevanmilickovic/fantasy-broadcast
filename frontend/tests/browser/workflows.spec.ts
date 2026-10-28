import { expect, test, type Page } from '@playwright/test'
import { mockApp, viewer } from './fixtures'

async function checkViewport(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({
    path: test.info().outputPath(`${name}.png`),
    fullPage: true,
    animations: 'disabled',
  })
}

test('public navigation, login and password recovery remain usable', async ({ page }) => {
  const { errors, unexpectedRequests } = await mockApp(page, null)
  await page.goto('/')
  await expect(page.getByRole('navigation', { name: 'Public navigation' })).toBeVisible()
  await checkViewport(page)
  await screenshot(page, 'welcome')
  await page.getByRole('button', { name: 'Pricing', exact: true }).click()
  await expect(page).toHaveURL('/pricing')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await checkViewport(page)
  await screenshot(page, 'pricing')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible()
  await checkViewport(page)
  await screenshot(page, 'login')
  await page.getByRole('button', { name: 'Forgot password?' }).click()
  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible()
  await page.getByLabel('Email', { exact: true }).fill(viewer.email)
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.getByText('Check your email.', { exact: true })).toBeVisible()
  await page.goto('/login')
  await page.getByLabel('Email or username').fill(viewer.email)
  await page.getByLabel('Password', { exact: true }).fill('test-password-123')
  await page.locator('.account-card').getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Choose a league' })).toBeVisible()
  expect(errors).toEqual([])
  expect(unexpectedRequests).toEqual([])
})

test('league selection, standings, matchups and team views remain usable', async ({ page }) => {
  const { errors, unexpectedRequests } = await mockApp(page)
  await page.goto('/leagues')
  await expect(page.getByRole('heading', { name: 'Choose a league' })).toBeVisible()
  await checkViewport(page)
  await screenshot(page, 'leagues')
  await page.getByRole('button', { name: /Sunday League Elite/ }).click()
  await expect(page.getByRole('heading', { name: 'Sunday League Elite' })).toBeVisible()
  await checkViewport(page)
  await screenshot(page, 'standings')
  await page.getByRole('button', { name: 'Matchups', exact: true }).click()
  await expect(page.locator('.matchweek-group > header')).toHaveText('Gameweek 24')
  await checkViewport(page)
  await screenshot(page, 'matchups')
  await page.getByRole('button', { name: 'Teams', exact: true }).click()
  await expect(page.locator('.manager-grid button')).toHaveCount(4)
  await page.locator('.manager-grid button').first().click()
  await expect(page.getByRole('region', { name: 'North Bank FC players' })).toBeVisible()
  await checkViewport(page)
  await screenshot(page, 'teams')
  await page
    .getByRole('button', { name: /View .* points/ })
    .first()
    .click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await screenshot(page, 'player-details')
  await page.getByRole('button', { name: 'Close player details' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(errors).toEqual([])
  expect(unexpectedRequests).toEqual([])
})

test('registration opens checkout and both plans require policy consent', async ({ page }) => {
  const { errors, unexpectedRequests } = await mockApp(page)
  await page.goto('/leagues/new')
  await expect(page.getByRole('heading', { name: 'Register a league' })).toBeVisible()
  await checkViewport(page)
  await screenshot(page, 'registration')
  await page.getByLabel('League ID', { exact: true }).fill('24024')
  await page.getByRole('button', { name: 'Register my league' }).click()
  await expect(
    page.getByRole('heading', { name: 'Bring your league to the broadcast.' }),
  ).toBeVisible()
  const standard = page.getByRole('button', { name: 'Choose Standard' })
  const ai = page.getByRole('button', { name: 'Choose AI Broadcaster' })
  await expect(standard).toBeDisabled()
  await expect(ai).toBeDisabled()
  await page.getByRole('checkbox').check()
  await expect(standard).toBeEnabled()
  await expect(ai).toBeEnabled()
  await checkViewport(page)
  await screenshot(page, 'checkout')
  expect(errors).toEqual([])
  expect(unexpectedRequests).toEqual([])
})

test('administration loads its independent registries and controls on desktop', async ({
  page,
}, info) => {
  test.skip(
    !['laptop', 'desktop', 'tv'].includes(info.project.name),
    'Administration targets desktop operators.',
  )
  const { errors, unexpectedRequests } = await mockApp(page, { ...viewer, role: 'ADMIN' })
  await page.goto('/administration')
  await expect(
    page.getByRole('heading', { name: 'Fantasy Broadcast Administration' }),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'League settings' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Broadcast controls' })).toBeVisible()
  await expect(page.getByText('No broadcast times have been scheduled.')).toBeVisible()
  await checkViewport(page)
  await screenshot(page, 'administration')
  expect(errors).toEqual([])
  expect(unexpectedRequests).toEqual([])
})
