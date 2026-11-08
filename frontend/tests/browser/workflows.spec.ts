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
  await expect(
    page.locator('.public-plans li').filter({ hasText: 'Up to 50 simultaneous viewers' }),
  ).toHaveCount(2)
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
  await page.getByLabel('Email').fill(viewer.email)
  await page.getByLabel('Password', { exact: true }).fill('test-password-123')
  await page.locator('.account-card').getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'My leagues' })).toBeVisible()
  await page.locator('.profile-menu summary').click()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('navigation', { name: 'Public navigation' })).toBeVisible()
  expect(errors).toEqual([])
  expect(unexpectedRequests).toEqual([])
})

test('league selection, standings, matchups and team views remain usable', async ({ page }) => {
  const { errors, unexpectedRequests } = await mockApp(page)
  await page.goto('/leagues')
  await expect(page.getByRole('heading', { name: 'My leagues' })).toBeVisible()
  await checkViewport(page)
  await screenshot(page, 'leagues')
  await page.getByRole('link', { name: /Sunday League Elite/ }).click()
  await expect(page.getByRole('heading', { name: 'Sunday League Elite' })).toBeVisible()
  await checkViewport(page)
  await screenshot(page, 'standings')
  await page.getByRole('tab', { name: 'Matchups', exact: true }).click()
  await expect(page.locator('.matchweek-group > header')).toHaveText('Gameweek 24')
  await checkViewport(page)
  await screenshot(page, 'matchups')
  await page.getByRole('tab', { name: 'Teams', exact: true }).click()
  await expect(page.locator('.manager-grid button')).toHaveCount(4)
  if ((page.viewportSize()?.width ?? 0) >= 960) {
    await expect(page.locator('.league-club-select .league-select-trigger')).toBeHidden()
    const panel = await page.locator('.league-manager-panel').boundingBox()
    const squad = await page.locator('.league-team-stage').boundingBox()
    expect(squad?.x).toBeGreaterThan((panel?.x ?? 0) + (panel?.width ?? 0))
  } else {
    await expect(page.locator('.league-club-select .league-select-trigger')).toBeVisible()
    await expect(page.locator('.league-manager-panel')).toBeHidden()
  }
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
  await expect(
    page.locator('.checkout-plan li').filter({ hasText: '50 simultaneous viewers' }),
  ).toHaveCount(2)
  await expect(page.locator('.checkout-heading')).toContainText(
    'Each open broadcast tab or device counts as one viewer.',
  )
  await expect(standard).toBeEnabled()
  await expect(ai).toBeEnabled()
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

test('league queries show loading, errors and empty onboarding', async ({ page }) => {
  const { errors } = await mockApp(page)
  let release: () => void = () => undefined
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/customer/leagues', async (route) => {
    await pending
    await route.fulfill({ status: 503, json: { detail: 'League service unavailable.' } })
  })
  await page.goto('/leagues')
  await expect(page.getByText('Loading leagues…', { exact: true })).toBeVisible()
  release()
  await expect(page.getByRole('alert')).toHaveText('League service unavailable.')
  await checkViewport(page)
  await page.route('**/api/customer/leagues', (route) => route.fulfill({ json: [] }))
  await page.reload()
  await expect(page.getByRole('heading', { name: 'My leagues', exact: true })).toBeVisible()
  await expect(page).toHaveURL('/leagues')
  await expect(
    page.getByText('Find a league to follow, or register a league you manage.'),
  ).toBeVisible()
  expect(errors).toEqual([])
})

test('registration verifies email and password reset confirms completion', async ({ page }) => {
  const { errors } = await mockApp(page, null)
  await page.route('**/api/auth/register', (route) =>
    route.fulfill({
      json: {
        email: viewer.email,
        message: 'Check your email.',
      },
    }),
  )
  let attempts = 0
  await page.route('**/api/auth/register/verify', (route) => {
    attempts += 1
    return attempts === 1
      ? route.fulfill({ status: 400, json: { detail: 'Invalid code.' } })
      : route.fulfill({ json: { user: viewer } })
  })
  await page.goto('/register')
  await page.getByLabel('Email', { exact: true }).fill(viewer.email)
  await page.getByLabel('New password', { exact: true }).fill('test-password-123')
  await page.getByLabel('Confirm password', { exact: true }).fill('test-password-123')
  await page.getByRole('button', { name: 'Register', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Check your email', exact: true })).toBeVisible()
  await page.getByLabel('Verification code').fill('000000')
  await page.getByRole('button', { name: 'Verify email', exact: true }).click()
  await expect(page.getByText('Invalid code.', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Verification code')).toBeVisible()
  await page.getByLabel('Verification code').fill('123456')
  await page.getByRole('button', { name: 'Verify email', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'My leagues' })).toBeVisible()
  await page.route('**/api/auth/password/reset', (route) => route.fulfill({ status: 204 }))
  await page.goto('/reset-password?token=test-reset-token')
  await page.getByLabel('New password', { exact: true }).fill('another-password-123')
  await page.getByLabel('Confirm password', { exact: true }).fill('another-password-123')
  await page.getByRole('button', { name: 'Set new password', exact: true }).click()
  await expect(page).toHaveURL('/login')
  await expect(page.locator('.notification-host')).toContainText(
    'Password changed. Please sign in again.',
  )
  await checkViewport(page)
  expect(errors).toEqual([])
})
