import { expect, test } from '@playwright/test'
import { leagues, mockApp } from './fixtures'

test('paid registration waits for confirmation and opens the purchased league', async ({
  page,
}) => {
  const { errors, unexpectedRequests } = await mockApp(page)
  await page.route('**/api/customer/league-payment/checkout', (route) =>
    route.fulfill({
      json: {
        transactionId: 'txn_test',
        clientSideToken: 'test_token',
        fplLeagueId: leagues[0].fplLeagueId,
        leagueType: 'DRAFT',
      },
    }),
  )
  await page.route('https://cdn.paddle.com/paddle/v2/paddle.js', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `window.Paddle = {
      Environment: { set() {} },
      Initialize(options) { window.completePayment = () => options.eventCallback({ name: 'checkout.completed' }); },
      Checkout: { open(options) { window.paymentSuccessUrl = options.settings.successUrl; }, close() {} }
    };`,
    }),
  )
  let confirmed = false
  await page.route('**/api/customer/leagues', (route) =>
    route.fulfill({
      json: confirmed ? leagues : [leagues[1]],
    }),
  )
  await page.goto(`/leagues/checkout?fplLeagueId=${leagues[0].fplLeagueId}&leagueType=DRAFT`)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Choose Standard' }).click()
  const successPath = `/leagues/checkout?fplLeagueId=${leagues[0].fplLeagueId}&leagueType=DRAFT&payment=completed`
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, 'paymentSuccessUrl')))
    .toBe(`http://127.0.0.1:4173${successPath}`)
  await page.evaluate(() => Reflect.get(window, 'completePayment')())
  await expect(page).toHaveURL(successPath)
  await expect(page.getByRole('status')).toContainText('Waiting for payment confirmation')
  await expect(page.getByRole('button', { name: 'Choose Standard' })).toHaveCount(0)
  confirmed = true
  await expect(page).toHaveURL(`/league?leagueId=${leagues[0].id}`)
  await expect(page.getByRole('heading', { name: leagues[0].displayName })).toBeVisible()
  expect(errors).toEqual([])
  expect(unexpectedRequests).toEqual([])
})

test('payment confirmation failures can retry without another payment', async ({ page }) => {
  await mockApp(page)
  await page.route('**/api/customer/leagues', (route) =>
    route.fulfill({ status: 503, json: { detail: 'Temporarily unavailable.' } }),
  )
  await page.goto(
    `/leagues/checkout?fplLeagueId=${leagues[0].fplLeagueId}&leagueType=DRAFT&payment=completed`,
  )
  await expect(page.getByRole('button', { name: 'Check again' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Please do not pay again')
  await page.unroute('**/api/customer/leagues')
  await page.getByRole('button', { name: 'Check again' }).click()
  await expect(page).toHaveURL(`/league?leagueId=${leagues[0].id}`)
})
