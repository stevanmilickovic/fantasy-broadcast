import { expect, test, type Page } from '@playwright/test'
import { mockApp } from './fixtures'

async function mockCheckout(page: Page) {
  await mockApp(page)
  let requests = 0
  await page.route('**/api/customer/league-payment/checkout', (route) => {
    requests++
    return route.fulfill({
      json: {
        transactionId: 'txn_test',
        clientSideToken: 'test_token',
        fplLeagueId: 42,
        leagueType: 'DRAFT',
      },
    })
  })
  await page.route('https://cdn.paddle.com/paddle/v2/paddle.js', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `
        window.Paddle = {
          Environment: { set() {} },
          Initialize(options) { window.paddleEvent = name => options.eventCallback({ name }); },
          Checkout: {
            open() {
              const frame = document.createElement('iframe');
              frame.title = 'Secure checkout';
              frame.style = 'position:fixed;inset:0;width:100%;height:100%;z-index:9999;background:white';
              frame.srcdoc = '<button aria-label="Close checkout" onclick="parent.Paddle.Checkout.close()">×</button>';
              document.body.append(frame);
              window.paddleEvent('checkout.loaded');
            },
            close() {
              document.querySelector('iframe[title="Secure checkout"]')?.remove();
              window.paddleEvent('checkout.closed');
            }
          }
        };
      `,
    }),
  )
  return () => requests
}

test('checkout X restores the selected plan and permits reopening without a duplicate submission', async ({
  page,
}) => {
  const requests = await mockCheckout(page)
  await page.goto('/leagues/checkout?fplLeagueId=42&leagueType=DRAFT')
  await page.getByRole('radio', { name: /Standard/ }).check()
  await page.getByRole('checkbox').check()
  const plan = page.getByRole('button', { name: 'Continue to payment', exact: true })
  for (let attempt = 1; attempt <= 2; attempt++) {
    await plan.click()
    await expect(plan).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Edit league' })).toBeDisabled()
    await expect(page.locator('.league-checkout-page').getByRole('status')).toContainText(
      'Complete or close',
    )
    expect(requests()).toBe(attempt)
    await page
      .frameLocator('iframe[title="Secure checkout"]')
      .getByRole('button', { name: 'Close checkout' })
      .click()
    await expect(page.locator('iframe')).toHaveCount(0)
    await expect(plan).toBeEnabled()
    await expect(plan).toBeFocused()
    await expect(page.getByRole('checkbox')).toBeChecked()
    await expect(page.getByRole('region', { name: 'Your league' })).toContainText(
      'Draft league #42',
    )
    await expect(page.getByRole('status')).toContainText('selections have been kept')
    await expect(page).toHaveURL('/leagues/checkout?fplLeagueId=42&leagueType=DRAFT&plan=STANDARD')
  }
})

test('leaving registration closes the overlay and ignores late completion', async ({ page }) => {
  await mockCheckout(page)
  await page.goto('/leagues/new')
  await page.getByLabel('League ID', { exact: true }).fill('42')
  await page.getByRole('button', { name: 'Verify league' }).click()
  await page.getByRole('button', { name: 'Continue to review' }).click()
  await page.getByRole('radio', { name: /Standard/ }).check()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Continue to payment', exact: true }).click()
  await expect(page.locator('iframe')).toHaveCount(1)
  await page.goBack()
  await expect(page).toHaveURL('/leagues/new?fplLeagueId=42&leagueType=DRAFT')
  await expect(page.locator('iframe')).toHaveCount(0)
  await page.evaluate(() => Reflect.get(window, 'paddleEvent')('checkout.completed'))
  await expect(page).toHaveURL('/leagues/new?fplLeagueId=42&leagueType=DRAFT')
})
