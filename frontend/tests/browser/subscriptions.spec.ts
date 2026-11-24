import { expect, test } from '@playwright/test'
import { mockApp, viewer } from './fixtures'

const initialSubscription = {
  linked: true,
  subscriptionId: 'sub_test',
  plan: 'STANDARD',
  renewalPlan: 'STANDARD',
  status: 'active',
  accessUntil: '2026-12-20T12:00:00Z',
  cancelAt: null as string | null,
  accessActive: true,
  refundUntil: '2026-11-10T12:00:00Z',
  awaitingConfirmation: false,
  currencyCode: 'EUR',
  renewalTotal: '699',
}

test('account subscriptions opens from both entry points and lets owners manage each league', async ({
  page,
}, info) => {
  if (info.project.name === 'phone') await page.setViewportSize({ width: 320, height: 750 })
  const { errors, unexpectedRequests } = await mockApp(page)
  let sunday = { ...initialSubscription }
  const classicName = 'Midweek Classic Championship with a long league name'
  const midweek = { ...initialSubscription, status: 'canceled', accessActive: false }
  await page.route('**/api/customer/subscriptions', (route) =>
    route.fulfill({
      json: [
        {
          ...sunday,
          leagueId: 1,
          leagueName: 'Sunday League Elite',
          fplLeagueId: 42,
          leagueType: 'DRAFT',
        },
        {
          ...midweek,
          leagueId: 2,
          leagueName: classicName,
          fplLeagueId: 1234,
          leagueType: 'CLASSIC',
        },
      ],
    }),
  )
  const openedLeagues: string[] = []
  await page.route(/\/api\/customer\/leagues\/[12]\/subscription(?:\?|\/)/, (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/cancel')) {
      expect(route.request().postDataJSON()).toMatchObject({ undo: false })
      sunday = { ...sunday, cancelAt: sunday.accessUntil }
    } else {
      openedLeagues.push(path)
    }
    return route.fulfill({ json: path.includes('/leagues/1/') ? sunday : midweek })
  })

  await page.goto('/leagues')
  await page.getByLabel('Account menu').click()
  await page.getByRole('button', { name: 'Subscriptions', exact: true }).click()
  await expect(page).toHaveURL('/account/subscriptions')
  const sundayCard = page.getByRole('link', { name: /Sunday League Elite/ })
  await expect(sundayCard).toContainText('Standard')
  await expect(page.getByRole('link', { name: new RegExp(classicName) })).toContainText('Canceled')
  expect(openedLeagues).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({
    path: info.outputPath('account-subscriptions.png'),
    fullPage: true,
    animations: 'disabled',
  })

  await page.getByRole('button', { name: 'Back to account settings' }).click()
  await page.getByRole('button', { name: 'Manage subscriptions' }).click()
  await expect(page).toHaveURL('/account/subscriptions')
  await sundayCard.click()
  await expect(page).toHaveURL('/account/subscriptions?leagueId=1')
  await expect(
    page.getByRole('heading', { name: 'Sunday League Elite', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Payment details & invoices' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Email a refund request' })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel subscription', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm cancellation', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Keep subscription', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'All subscriptions', exact: true }).click()
  await expect(sundayCard).toContainText('Renewal canceled')
  expect(openedLeagues).toEqual(Array(2).fill('/api/customer/leagues/1/subscription'))

  await page.getByRole('link', { name: new RegExp(classicName) }).click()
  await page.getByRole('button', { name: 'Subscribe again' }).click()
  await expect(page).toHaveURL('/leagues/checkout?fplLeagueId=1234&leagueType=CLASSIC')
  expect(errors).toEqual([])
  expect(unexpectedRequests).toEqual([])
})

test('account subscriptions handles errors, an empty list, and unavailable deep links', async ({
  page,
}) => {
  const { unexpectedRequests } = await mockApp(page)
  let requests = 0
  await page.route('**/api/customer/subscriptions', (route) =>
    ++requests === 1
      ? route.fulfill({ status: 503, json: { detail: 'Could not load subscriptions.' } })
      : route.fulfill({ json: [] }),
  )
  await page.goto('/account/subscriptions')
  await expect(page.getByRole('alert')).toContainText('Could not load subscriptions.')
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText('You don’t have any league subscriptions yet.')).toBeVisible()
  await page.goto('/account/subscriptions?leagueId=99')
  await expect(page.getByText('This subscription is unavailable for your account.')).toBeVisible()
  expect(unexpectedRequests).toEqual([])
})

test('owners can review upgrades, schedule downgrades and undo cancellation', async ({ page }) => {
  const { errors, unexpectedRequests } = await mockApp(page)
  let subscription = { ...initialSubscription }
  let changes = 0
  await page.route('**/api/customer/leagues/1/subscription**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/preview')) {
      const { target } = route.request().postDataJSON()
      return route.fulfill({
        json: {
          target,
          version: '2026-10-29T12:00:00Z',
          effectiveAt: subscription.accessUntil,
          chargeNow: target === 'AI_BROADCASTER' && subscription.plan === 'STANDARD' ? '500' : '0',
          currencyCode: 'EUR',
          renewalTotal: target === 'STANDARD' ? '699' : '1999',
          immediate: target === 'AI_BROADCASTER' && subscription.plan === 'STANDARD',
        },
      })
    }
    if (path.endsWith('/plan')) {
      const { target, requestId } = route.request().postDataJSON()
      expect(requestId).toMatch(/^[a-f0-9-]{36}$/)
      changes++
      subscription = {
        ...subscription,
        plan: 'AI_BROADCASTER',
        renewalPlan: target,
        renewalTotal: target === 'STANDARD' ? '699' : '1999',
      }
    }
    if (path.endsWith('/cancel')) {
      const { undo } = route.request().postDataJSON()
      subscription = { ...subscription, cancelAt: undo ? null : subscription.accessUntil }
    }
    return route.fulfill({ json: subscription })
  })
  await page.goto('/league?leagueId=1')
  await page.getByLabel('League actions').click()
  await expect(page.getByRole('button', { name: 'Delete my league' })).toHaveCount(0)
  await page.getByRole('button', { name: 'League management', exact: true }).click()
  await expect(page).toHaveURL('/league/manage?leagueId=1')
  await page.locator('summary').filter({ hasText: 'Subscription' }).click()
  await expect(page.getByRole('heading', { name: 'League management', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Upgrade to AI', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Confirm plan change' })).toContainText('€5.00')
  expect(changes).toBe(0)
  await page.getByRole('button', { name: 'Confirm plan change' }).click()
  await expect(page.getByRole('heading', { name: 'AI Broadcaster', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Downgrade to Standard' }).click()
  await page.getByRole('button', { name: 'Confirm plan change' }).click()
  await expect(page.getByText(/AI remains available until then/)).toBeVisible()
  await page.getByRole('button', { name: 'Keep AI Broadcaster' }).click()
  await expect(page.getByRole('region', { name: 'Confirm plan change' })).toContainText('€0.00')
  await page.getByRole('button', { name: 'Confirm plan change' }).click()
  await page.getByRole('button', { name: 'Cancel subscription', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm cancellation', exact: true }).click()
  await expect(page.getByText('Renewal is cancelled. You will not be charged again.')).toBeVisible()
  await page.getByRole('button', { name: 'Keep subscription', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm keep subscription', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Cancel subscription', exact: true })).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('subscription.png'), fullPage: true })
  await expect(page.getByRole('link', { name: 'Email a refund request' })).toHaveAttribute(
    'href',
    /mailto:.*sub_test/,
  )
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
  expect(unexpectedRequests).toEqual([])
})

test('administrators review partial refunds and see pending approval without duplicate submission', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'Administration targets desktop operators.')
  const { errors, unexpectedRequests } = await mockApp(page, { ...viewer, role: 'ADMIN' })
  const payment = {
    id: 'txn_test',
    currencyCode: 'EUR',
    total: 1999,
    refundable: 1999,
    paidAt: '2026-10-29T12:00:00Z',
    initialPurchase: true,
    withinRefundWindow: true,
    refunds: [] as { id: string; status: string; amount: number; reason: string }[],
    awaitingConfirmation: false,
  }
  let submissions = 0
  await page.route('**/api/customer/admin/subscriptions**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/payments')) return route.fulfill({ json: [payment] })
    if (path.endsWith('/refunds')) {
      submissions++
      const input = route.request().postDataJSON()
      expect(input).toMatchObject({
        transactionId: 'txn_test',
        partialAmount: 500,
        endsAccess: false,
        reason: 'Service issue reported by email',
      })
      const refund = {
        id: 'adj_test',
        status: 'pending_approval',
        amount: 500,
        reason: input.reason,
      }
      payment.refunds = [refund]
      payment.refundable = 999
      return route.fulfill({ json: refund })
    }
    return route.fulfill({
      json: {
        items: [
          {
            id: 'sub_test',
            leagueId: 1,
            leagueName: 'Sunday League Elite',
            ownerName: `${viewer.displayName} (#${viewer.id})`,
            plan: 'AI_BROADCASTER',
            status: 'active',
            periodEnd: initialSubscription.accessUntil,
          },
        ],
        page: 0,
        size: 10,
        totalItems: 1,
      },
    })
  })
  await page.goto('/administration')
  const billing = page.getByRole('region', { name: 'Subscriptions and refunds' })
  await billing.getByRole('button', { name: /Sunday League Elite/ }).click()
  await billing.getByRole('button', { name: 'Review refund', exact: true }).click()
  await billing
    .getByRole('combobox', { name: 'Refund amount', exact: true })
    .selectOption('partial')
  await billing.getByLabel('Amount in EUR, including tax').fill('5.00')
  await billing.getByLabel('Reason', { exact: true }).fill('Service issue reported by email')
  await billing
    .getByLabel('End this subscription and its paid access when the refund is approved')
    .uncheck()
  await billing.getByRole('button', { name: 'Review before submitting' }).click()
  expect(submissions).toBe(0)
  await expect(billing.getByText(/Refund €5.00 to the original payment method/)).toBeVisible()
  await billing.getByRole('button', { name: 'Submit refund to Paddle' }).click()
  await expect(billing.getByRole('status').filter({ hasText: 'Refund submitted.' })).toContainText(
    'Paddle approval is pending',
  )
  await expect(billing.getByRole('button', { name: 'Review refund', exact: true })).toBeDisabled()
  expect(submissions).toBe(1)
  await billing.screenshot({ path: test.info().outputPath('refunds.png') })
  expect(errors).toEqual([])
  expect(unexpectedRequests).toEqual([])
})
