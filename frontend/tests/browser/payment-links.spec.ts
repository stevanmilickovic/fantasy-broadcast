import { expect, test, type Page } from '@playwright/test'
import { mockApp, viewer } from './fixtures'

const transaction = 'txn_0123456789abcdefghijklmnop'

async function mockPaddle(page: Page, failed = false) {
  await page.route('**/api/paddle/configuration', (route) =>
    route.fulfill({ json: { clientSideToken: 'test_public-token' } }),
  )
  await page.route('https://cdn.paddle.com/paddle/v2/paddle.js', async (route) => {
    if (failed) return route.abort()
    return route.fulfill({
      contentType: 'text/javascript',
      body: `
      window.paddleCalls = [];
      window.Paddle = {
        Environment: { set: value => window.paddleCalls.push(['environment', value]) },
        Initialize: options => {
          window.paddleCalls.push(['initialize', options.token, new URLSearchParams(location.search).get('_ptxn')]);
          window.paddleEvent = name => options.eventCallback({name});
          window.paddleEvent('checkout.loaded');
        },
        Checkout: {
          open: options => window.paddleCalls.push(['open', options.transactionId]),
          close: () => { window.paddleCalls.push(['close']); window.paddleEvent('checkout.closed'); }
        }
      };
    `,
    })
  })
}

async function calls(page: Page) {
  return page.evaluate(() => Reflect.get(window, 'paddleCalls') as string[][])
}

async function event(page: Page, name: string) {
  await page.evaluate((value) => Reflect.get(window, 'paddleEvent')(value), name)
}

test('direct links open the existing transaction while signed out and preserve completion', async ({
  page,
}) => {
  const { errors, unexpectedRequests } = await mockApp(page, null)
  await mockPaddle(page)
  await page.goto(`/pay?_ptxn=${transaction}`)
  await expect(page.getByRole('heading', { name: 'Secure payment' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('secure Paddle window')
  expect(await calls(page)).toEqual([
    ['environment', 'sandbox'],
    ['initialize', 'test_public-token', transaction],
  ])
  await event(page, 'checkout.completed')
  await event(page, 'checkout.closed')
  await expect(page.getByRole('status')).toContainText('All set')
  await expect(page.getByRole('link', { name: 'Go to your account' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
  expect(unexpectedRequests).toEqual([])
})

test('valid payment links do not wait for the account session and can be dismissed and reopened', async ({
  page,
}) => {
  await mockApp(page, viewer)
  let finishSession = () => {}
  const sessionResponse = new Promise<void>((resolve) => {
    finishSession = resolve
  })
  await page.route('**/api/auth/me', async (route) => {
    await sessionResponse
    await route.fulfill({ status: 503, json: {} })
  })
  await mockPaddle(page)
  await page.goto(`/pay?_ptxn=${transaction}`)
  await expect(page.getByRole('status')).toContainText('secure Paddle window')
  finishSession()
  await event(page, 'checkout.closed')
  await expect(page.getByRole('status')).toContainText('Checkout closed')
  await page.getByRole('button', { name: 'Reopen checkout' }).click()
  await expect(page.getByRole('status')).toContainText('secure Paddle window')
  await page.getByRole('button', { name: 'Pricing', exact: true }).click()
  await expect(page).toHaveURL('/pricing')
  expect((await calls(page)).filter((call) => call[0] === 'close')).toHaveLength(1)
  await page.goBack()
  await expect(page).toHaveURL(`/pay?_ptxn=${transaction}`)
  await expect(page.getByRole('status')).toContainText('secure Paddle window')
})

test('missing or invalid payment references never load Paddle or create a checkout', async ({
  page,
}) => {
  const { errors, unexpectedRequests } = await mockApp(page, null)
  let loaded = 0
  await page.route('https://cdn.paddle.com/**', (route) => {
    loaded++
    return route.abort()
  })
  for (const query of ['', '?_ptxn=invalid', `?_ptxn=${transaction}&_ptxn=${transaction}`]) {
    await page.goto('/pay' + query)
    await expect(page.getByRole('heading', { name: 'Secure payment' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Go to your account' })).toBeVisible()
  }
  expect(loaded).toBe(0)
  expect(errors).toEqual([])
  expect(unexpectedRequests).toEqual([])
})

test('configuration and SDK failures offer recovery', async ({ page }) => {
  await mockApp(page, null)
  await mockPaddle(page, true)
  await page.route('**/api/paddle/configuration', (route) =>
    route.fulfill({ status: 503, json: { detail: 'Payment checkout is currently unavailable.' } }),
  )
  await page.goto(`/pay?_ptxn=${transaction}`)
  await expect(page.getByRole('alert')).toContainText('currently unavailable')
  await page.unroute('**/api/paddle/configuration')
  await page.route('**/api/paddle/configuration', (route) =>
    route.fulfill({ json: { clientSideToken: 'test_public-token' } }),
  )
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Secure checkout could not be loaded')
  await mockPaddle(page)
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('secure Paddle window')
  await event(page, 'checkout.error')
  await expect(page.getByRole('alert')).toContainText('This checkout could not be opened')
})
