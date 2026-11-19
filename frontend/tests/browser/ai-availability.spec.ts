import { expect, test } from '@playwright/test'
import { mockApp } from './fixtures'

const plansUrl = '**/api/paddle/plans'

test('disabled AI leaves Standard available on pricing, checkout and subscription settings', async ({
  page,
}, info) => {
  const { errors, unexpectedRequests } = await mockApp(page)
  await page.route(plansUrl, (route) => route.fulfill({ json: { aiBroadcasterEnabled: false } }))
  await page.goto('/pricing')
  await expect(page.getByRole('status')).toHaveCount(0)
  await expect(page.locator('.public-plans article')).toHaveCount(2)
  await expect(page.locator('.public-plans')).toContainText('€6.99')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('standard-only-pricing.png'), fullPage: true })

  await page.goto('/leagues/checkout?fplLeagueId=42&leagueType=DRAFT')
  const ai = page.getByRole('radio', { name: 'AI Broadcaster' })
  await expect(ai).toBeDisabled()
  await expect(ai).toHaveAccessibleDescription(/Currently unavailable/)
  await page.getByRole('radio', { name: /Standard/ }).check()
  await page.getByRole('checkbox').check()
  await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeEnabled()
  await expect(page.getByRole('radio')).toHaveCount(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('standard-only-checkout.png'), fullPage: true })

  await page.route('**/api/customer/leagues/1/subscription**', (route) =>
    route.fulfill({
      json: {
        linked: true,
        subscriptionId: 'sub_test',
        plan: 'STANDARD',
        renewalPlan: 'STANDARD',
        status: 'active',
        accessUntil: '2026-12-20T12:00:00Z',
        cancelAt: null,
        accessActive: true,
        refundUntil: null,
        awaitingConfirmation: false,
        currencyCode: 'EUR',
        renewalTotal: '699',
      },
    }),
  )
  await page.goto('/league/manage?leagueId=1')
  const subscription = page.getByRole('region', { name: 'Subscription', exact: true })
  await expect(subscription.getByRole('status')).toHaveCount(0)
  await expect(subscription.getByRole('button', { name: 'Upgrade to AI' })).toHaveCount(0)
  await expect(
    subscription.getByRole('button', { name: 'Cancel subscription', exact: true }),
  ).toBeEnabled()
  expect(errors).toEqual([])
  expect(unexpectedRequests).toEqual([])
})

test('availability errors keep AI disabled without blocking Standard', async ({ page }) => {
  await mockApp(page)
  await page.route(plansUrl, (route) => route.fulfill({ status: 503, json: {} }))
  await page.goto('/leagues/checkout?fplLeagueId=42')
  await expect(page.getByRole('group', { name: 'Choose a plan' })).toContainText(
    'AI plan availability could not be checked. Standard remains available.',
  )
  const ai = page.getByRole('radio', { name: 'AI Broadcaster' })
  await expect(ai).toBeDisabled()
  await expect(ai).toHaveAccessibleDescription(/availability could not be checked/)
  await page.getByRole('radio', { name: /Standard/ }).check()
  await page.getByRole('checkbox').check()
  await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeEnabled()
})
