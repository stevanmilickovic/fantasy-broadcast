import { expect, test, type Page } from '@playwright/test'
import { mockApp } from './fixtures'

const validLeague = {
  displayName: 'Sunday League Elite',
  managerCount: 12,
  registrationEligible: true,
  validationMessage: null,
  checkoutReady: true,
}
const previewUrl = '**/api/customer/league-payment/preview**'

async function layout(page: Page) {
  return page.locator('.checkout-league-card, .checkout-plans').evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect()
      return {
        top: rect.top + scrollY,
        left: rect.left + scrollX,
        width: rect.width,
        height: rect.height,
      }
    }),
  )
}

async function checkConsent(page: Page) {
  const checkbox = page.getByRole('checkbox')
  await checkbox.check()
  const input = await checkbox.boundingBox()
  const label = await page.locator('.checkout-consent label').boundingBox()
  expect(input).not.toBeNull()
  expect(label).not.toBeNull()
  expect(input?.width).toBe(18)
  expect(input?.height).toBe(18)
  expect((input?.x ?? 0) + (input?.width ?? 0)).toBeLessThan(label?.x ?? 0)
  expect(Math.abs((input?.y ?? 0) - (label?.y ?? 0))).toBeLessThanOrEqual(3)
  await expect(page.getByRole('link', { name: 'Terms of Service', exact: true })).toHaveAttribute(
    'href',
    '/terms',
  )
}

test('unavailable leagues show stable visible errors without hover movement or overflow', async ({
  page,
}, info) => {
  if (info.project.name === 'phone') await page.setViewportSize({ width: 320, height: 740 })
  const { errors, unexpectedRequests } = await mockApp(page)
  const message =
    'No draft FPL league was found with this ID. Check that the league still exists and the league type is correct.'
  await page.route(previewUrl, (route) =>
    route.fulfill({
      json: {
        displayName: 'League unavailable',
        managerCount: 0,
        registrationEligible: false,
        validationMessage: message,
        checkoutReady: false,
      },
    }),
  )
  await page.goto('/leagues/checkout?fplLeagueId=999&leagueType=DRAFT')
  await expect(page.getByRole('alert')).toHaveText(message)
  await expect(page.getByLabel('FPL league ID', { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  )
  await page.evaluate(() => document.fonts.ready)
  const before = await layout(page)
  for (const selector of [
    '.checkout-eyebrow',
    '.checkout-league-name strong',
    '.checkout-league-summary',
  ]) {
    await page.locator(selector).hover()
    expect(await layout(page)).toEqual(before)
    await expect(page.getByRole('alert')).toBeVisible()
  }
  await checkConsent(page)
  await expect(page.getByRole('button', { name: 'Choose Standard', exact: true })).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Choose AI Broadcaster', exact: true }),
  ).toBeDisabled()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('unavailable-league.png'), fullPage: true })
  expect(errors).toEqual([])
  expect(unexpectedRequests).toEqual([])
})

test('closed registrations use customer-facing copy and keep checkout disabled after consent', async ({
  page,
}, info) => {
  await mockApp(page)
  await page.route(previewUrl, (route) =>
    route.fulfill({
      json: {
        ...validLeague,
        displayName:
          'A league with a very long name that should wrap cleanly on every screen without pushing the controls outside the page',
        checkoutReady: false,
      },
    }),
  )
  await page.goto('/leagues/checkout?fplLeagueId=42&leagueType=DRAFT')
  await expect(page.getByRole('status')).toHaveText(
    'New league registrations are temporarily unavailable. Please try again later.',
  )
  await expect(page.getByLabel('League verified', { exact: true })).toBeVisible()
  await checkConsent(page)
  await expect(page.getByRole('button', { name: 'Choose Standard', exact: true })).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Choose AI Broadcaster', exact: true }),
  ).toBeDisabled()
  await expect(page.getByText(/sandbox credentials|payment testing|price IDs/)).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('registrations-closed.png'), fullPage: true })
})

test('missing and malformed league IDs prompt for correction without verification requests', async ({
  page,
}) => {
  await mockApp(page)
  let requests = 0
  await page.route(previewUrl, (route) => {
    requests++
    return route.fulfill({ json: validLeague })
  })
  await page.goto('/leagues/checkout')
  await expect(page.getByText('Enter your league ID', { exact: true })).toBeVisible()
  const input = page.getByLabel('FPL league ID', { exact: true })
  for (const value of ['-1', 'not-an-id', '9007199254740992']) {
    await input.fill(value)
    await expect(page.getByRole('alert')).toHaveText('Enter a valid, positive FPL league ID.')
  }
  expect(requests).toBe(0)
  await input.fill('42')
  await expect(page.getByText(validLeague.displayName, { exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await checkConsent(page)
  await expect(page.getByRole('button', { name: 'Choose Standard', exact: true })).toBeEnabled()
})

test('verification can retry and payment failures appear separately from league verification', async ({
  page,
}) => {
  await mockApp(page)
  let requests = 0
  await page.route(previewUrl, (route) =>
    ++requests === 1
      ? route.fulfill({
          status: 503,
          json: { detail: 'We could not verify this league. Please try again.' },
        })
      : route.fulfill({ json: validLeague }),
  )
  await page.route('**/api/customer/league-payment/checkout', (route) =>
    route.fulfill({
      status: 409,
      json: { detail: 'We could not start this payment. Please try again.' },
    }),
  )
  await page.goto('/leagues/checkout?fplLeagueId=42')
  await expect(page.getByRole('alert')).toContainText('could not verify this league')
  await page.getByRole('button', { name: 'Try verification again', exact: true }).click()
  await expect(page.getByLabel('League verified', { exact: true })).toBeVisible()
  await checkConsent(page)
  await page.getByRole('button', { name: 'Choose Standard', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText(
    'We could not start this payment. Please try again.',
  )
  await expect(page.locator('.checkout-league-summary [role="alert"]')).toHaveCount(0)
  await expect(page.getByLabel('League verified', { exact: true })).toBeVisible()
  await page.locator('.checkout-eyebrow').hover()
  await expect(page.getByRole('alert')).toBeVisible()
})
