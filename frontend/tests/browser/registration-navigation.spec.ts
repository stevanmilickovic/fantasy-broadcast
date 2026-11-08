import { expect, test } from '@playwright/test'
import { leagues, mockApp, viewer } from './fixtures'

test('a new account returns to league registration after email verification', async ({ page }) => {
  await mockApp(page, null)
  await page.route('**/api/auth/register', (route) =>
    route.fulfill({ json: { email: viewer.email, message: 'Check your email.' } }),
  )
  await page.route('**/api/auth/register/verify', (route) =>
    route.fulfill({ json: { user: viewer } }),
  )
  await page.goto('/leagues/new')
  await page.getByLabel('Email', { exact: true }).fill(viewer.email)
  await page.getByLabel('New password', { exact: true }).fill('new-password-123')
  await page.getByLabel('Confirm password', { exact: true }).fill('new-password-123')
  await page.getByRole('button', { name: 'Register', exact: true }).click()
  await page.getByLabel('Verification code').fill('123456')
  await page.getByRole('button', { name: 'Verify email', exact: true }).click()
  await expect(page).toHaveURL('/leagues/new')
  await expect(page.getByRole('heading', { name: 'Register a league', exact: true })).toBeVisible()
})

test('Get started opens registration for an existing user and retains the selected pricing plan', async ({
  page,
}) => {
  await mockApp(page)
  await page.goto('/pricing')
  await page
    .locator('.public-plans article')
    .first()
    .getByRole('button', { name: 'Get started' })
    .click()
  await expect(page).toHaveURL('/leagues/new?plan=STANDARD')
  await page.getByLabel('League ID', { exact: true }).fill('123')
  await page.getByRole('button', { name: 'Register my league' }).click()
  await expect(page).toHaveURL('/leagues/checkout?fplLeagueId=123&leagueType=DRAFT&plan=STANDARD')
  await expect(page.locator('.checkout-plan[data-selected="true"]')).toContainText('Standard')
})

test('guest registration intent survives switching to login and refreshing', async ({ page }) => {
  await mockApp(page, null)
  await page.goto('/')
  await page.getByRole('button', { name: 'Get started', exact: true }).click()
  await expect(page).toHaveURL('/register?next=register')
  await page.reload()
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByLabel('Email').fill(viewer.email)
  await page.getByLabel('Password', { exact: true }).fill('test-password-123')
  await page.locator('.account-card').getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL('/leagues/new')
  await expect(page.getByRole('heading', { name: 'Register a league', exact: true })).toBeVisible()
})

test('Google redirect and failure retry retain only the allowed registration destination', async ({
  page,
}) => {
  await mockApp(page, null)
  let authenticated = false
  let failed = false
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ json: authenticated ? viewer : null }),
  )
  await page.route('**/api/auth/options', (route) =>
    route.fulfill({ json: { googleSignInEnabled: true } }),
  )
  await page.route('**/oauth2/authorization/google', (route) => {
    if (!failed) {
      failed = true
      return route.fulfill({ status: 302, headers: { location: '/login?oauth=failed' } })
    }
    authenticated = true
    return route.fulfill({ status: 302, headers: { location: '/' } })
  })
  await page.goto('/leagues/new?plan=AI_BROADCASTER')
  await page.getByRole('link', { name: 'Continue with Google' }).click()
  await expect(page).toHaveURL('/login?oauth=failed')
  await page.reload()
  await page.getByRole('link', { name: 'Continue with Google' }).click()
  await expect(page).toHaveURL('/leagues/new?plan=AI_BROADCASTER')
  expect(await page.evaluate(() => sessionStorage.getItem('fb:registration-intent'))).toBeNull()
})

for (const count of [0, 1, 2])
  test(`the league list remains reachable with ${count} leagues`, async ({ page }) => {
    await mockApp(page)
    await page.route('**/api/customer/leagues', (route) =>
      route.fulfill({ json: leagues.slice(0, count) }),
    )
    await page.goto('/leagues')
    await expect(page.getByRole('heading', { name: 'My leagues', exact: true })).toBeVisible()
    await expect(page).toHaveURL('/leagues')
    if (!count)
      await expect(
        page.getByRole('button', { name: 'Register a league', exact: true }),
      ).toBeVisible()
  })
