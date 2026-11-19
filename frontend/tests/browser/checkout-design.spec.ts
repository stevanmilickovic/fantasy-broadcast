import { expect, test, type Page } from '@playwright/test'
import { mockApp, viewer } from './fixtures'

const validLeague = {
  displayName: 'Sunday League Elite',
  managerCount: 12,
  registrationEligible: true,
  validationMessage: null,
  checkoutReady: true,
}
const previewUrl = '**/api/customer/league-payment/preview**'

async function layout(page: Page) {
  return page.locator('.checkout-review').evaluateAll((elements) =>
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
  const { width, height, horizontalGap, verticalGap } = await checkbox.evaluate((input) => {
    const copy = (input as HTMLInputElement).labels?.[0]?.querySelector('.checkout-consent-copy')
    if (!copy) throw new Error('Consent checkbox has no label text')
    const inputBounds = input.getBoundingClientRect()
    const labelBounds = copy.getBoundingClientRect()
    return {
      width: inputBounds.width,
      height: inputBounds.height,
      horizontalGap: labelBounds.left - inputBounds.right,
      verticalGap: Math.abs(labelBounds.top - inputBounds.top),
    }
  })
  expect(width).toBe(18)
  expect(height).toBe(18)
  expect(horizontalGap).toBeGreaterThan(0)
  expect(verticalGap).toBeLessThanOrEqual(3)
  await expect(
    page.getByRole('link', { name: 'Terms and Conditions', exact: true }),
  ).toHaveAttribute('href', '/terms')
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
  await page.evaluate(() => document.fonts.ready)
  const before = await layout(page)
  await page.getByRole('textbox', { name: 'FPL league ID' }).hover()
  expect(await layout(page)).toEqual(before)
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeEnabled()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('unavailable-league.png'), fullPage: true })
  expect(errors).toEqual([])
  expect(unexpectedRequests).toEqual([])
})

test('a test admin sees payment unavailable when checkout is disabled', async ({ page }, info) => {
  await mockApp(page, { ...viewer, role: 'ADMIN' })
  await page.route('**/leagues/checkout?*', async (route) => {
    const response = await route.fetch()
    const body = (await response.text()).replace(
      'name="fantasy-broadcast-version" content="dev"',
      'name="fantasy-broadcast-version" content="testing"',
    )
    await route.fulfill({ response, body })
  })
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
  await expect(page.getByRole('region', { name: 'Selected plan' }).getByRole('status')).toHaveText(
    'Payment is temporarily unavailable. Please try again later.',
  )
  await expect(page.getByLabel('League verified', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Register test league' })).toHaveCount(0)
  await expect(page.getByRole('checkbox')).not.toBeChecked()
  await expect(page.getByText(/sandbox credentials|payment testing|price IDs/)).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('payment-unavailable.png'), fullPage: true })
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
  const input = page.getByRole('textbox', { name: 'FPL league ID' })
  await page.getByRole('button', { name: 'Continue to payment' }).click()
  await expect(input).toBeFocused()
  for (const value of ['-1', 'not-an-id', '9007199254740992']) {
    await input.fill(value)
    await expect(page.getByRole('alert')).toHaveText('Enter a valid, positive FPL league ID.')
  }
  expect(requests).toBe(0)
  await input.fill('42')
  await expect(page.getByLabel('League verified')).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByText(validLeague.displayName)).toBeVisible()
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
  await page.route('**/api/customer/league-payment/checkout', (route) => {
    expect(route.request().postDataJSON()).toEqual({
      fplLeagueId: 42,
      leagueType: 'DRAFT',
      plan: 'STANDARD',
      acceptedPolicies: true,
      termsVersion: '2026-10-29',
    })
    return route.fulfill({
      status: 409,
      json: { detail: 'We could not start this payment. Please try again.' },
    })
  })
  await page.goto('/leagues/checkout?fplLeagueId=42')
  await expect(page.getByRole('alert')).toContainText('could not verify this league')
  await page.getByRole('button', { name: 'Try league lookup again', exact: true }).click()
  await expect(page.getByLabel('League verified', { exact: true })).toBeVisible()
  await page.getByRole('radio', { name: /Standard/ }).check()
  await checkConsent(page)
  await page.getByRole('button', { name: 'Continue to payment' }).click()
  await expect(page.getByRole('alert')).toHaveText(
    'We could not start this payment. Please try again.',
  )
  await expect(
    page.getByRole('group', { name: 'Register a league' }).getByRole('alert'),
  ).toHaveCount(0)
  await expect(page.getByLabel('League verified', { exact: true })).toBeVisible()
  await page.getByLabel('League verified').hover()
  await expect(page.getByRole('alert')).toBeVisible()
})

test('both registration routes honor closed registration from the server', async ({ page }) => {
  await mockApp(page)
  await page.route('**/api/customer/league-registration', (route) =>
    route.fulfill({ json: { canRegisterLeague: false } }),
  )
  let previews = 0
  await page.route(previewUrl, (route) => {
    previews++
    return route.fulfill({ json: validLeague })
  })
  for (const path of ['/leagues/new', '/leagues/checkout']) {
    await page.goto(`${path}?fplLeagueId=42&plan=STANDARD`)
    await expect(page.getByRole('heading', { name: 'League registration is closed' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'FPL league ID' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Continue to payment' })).toHaveCount(0)
  }
  expect(previews).toBe(0)
})

test('a tap brings consent into view on a short phone when it starts off screen', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'phone', 'Uses a short phone viewport.')
  await mockApp(page)
  await page.setViewportSize({ width: 320, height: 430 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/leagues/new?fplLeagueId=42')
  await expect(page.getByLabel('League verified')).toBeVisible()
  const standard = page.getByRole('radio', { name: /Standard/ })
  const consent = page.getByRole('checkbox')
  await standard.evaluate((element) => element.scrollIntoView({ block: 'end' }))
  await expect(consent).not.toBeInViewport()
  await standard.click()
  await expect(consent).toBeInViewport()
  const payment = page.getByRole('button', { name: 'Continue to payment' })
  await consent.evaluate((element) => element.scrollIntoView({ block: 'end' }))
  await expect(payment).not.toBeInViewport()
  await consent.click()
  await expect(payment).toBeInViewport({ ratio: 1 })
})

test('plan cards fit the first view and update the summary from their body, heading and keyboard', async ({
  page,
}, info) => {
  await mockApp(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/leagues/new?fplLeagueId=42')
  await expect(page.getByLabel('League verified')).toBeVisible()
  const standard = page.getByRole('radio', { name: 'Standard', exact: true })
  const ai = page.getByRole('radio', { name: 'AI Broadcaster', exact: true })
  await expect(ai).toBeEnabled()
  await expect(ai).toHaveAccessibleDescription(/€19\.99 per league \/ month.*AI voice commentary/)
  await expect(standard).not.toBeChecked()
  await expect(ai).not.toBeChecked()
  if (info.project.name === 'phone' || info.project.name === 'laptop') {
    await expect(page.getByText('€6.99', { exact: true })).toBeInViewport({ ratio: 1 })
    await expect(page.getByText('€19.99', { exact: true })).toBeInViewport({ ratio: 1 })
  }
  const summary = page.getByRole('region', { name: 'Selected plan' })
  await page
    .getByText('Live matchday broadcast, league standings and teams.', { exact: true })
    .click()
  await expect(standard).toBeChecked()
  await expect(summary).toContainText('Standard · €6.99 / month')
  await page.locator('.checkout-plan-name').getByText('AI Broadcaster', { exact: true }).click()
  await expect(ai).toBeChecked()
  await expect(summary).toContainText('AI Broadcaster · €19.99 / month')
  await ai.press('ArrowLeft')
  await expect(standard).toBeFocused()
  await expect(standard).toBeChecked()
  await expect(summary).toContainText('Standard · €6.99 / month')
})
