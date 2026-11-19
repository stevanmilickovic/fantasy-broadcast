import { expect, test } from '@playwright/test'
import { mockApp } from './fixtures'

for (const plan of ['STANDARD', 'AI_BROADCASTER']) {
  test(`preselected ${plan} keeps consent beside the payment action`, async ({ page }, info) => {
    await mockApp(page)
    let requests = 0
    await page.route('**/api/customer/league-payment/checkout', (route) => {
      requests++
      expect(route.request().postDataJSON()).toMatchObject({
        plan,
        acceptedPolicies: true,
        termsVersion: '2026-10-29',
      })
      return route.fulfill({
        status: 503,
        json: { message: 'Payment service unavailable for this test.' },
      })
    })
    await page.goto(`/leagues/checkout?fplLeagueId=42&leagueType=DRAFT&plan=${plan}`)
    const payment = page.getByRole('button', { name: 'Continue to payment' })
    await expect(payment).toBeEnabled()
    await expect(page.getByRole('radio')).toHaveCount(0)
    await payment.click()
    const checkbox = page.getByRole('checkbox')
    await expect(checkbox).toBeFocused()
    await expect(checkbox).not.toBeChecked()
    await expect(checkbox).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByRole('alert')).toContainText('Accept the terms')
    expect(requests).toBe(0)

    await checkbox.check()
    const policy = page.getByRole('link', { name: 'Terms of Service' })
    const [policyPage] = await Promise.all([page.waitForEvent('popup'), policy.click()])
    await expect(policyPage).toHaveURL(/\/terms$/)
    await policyPage.close()
    await expect(checkbox).toBeChecked()
    await expect(page.getByRole('alert')).toHaveCount(0)
    const consent = await page.locator('.checkout-consent').boundingBox()
    const button = await payment.boundingBox()
    expect(button?.y).toBeGreaterThanOrEqual((consent?.y ?? 0) + (consent?.height ?? 0))
    await page.screenshot({ path: info.outputPath(`consent-${plan}.png`), fullPage: true })
    expect(requests).toBe(0)
    await payment.click()
    await expect(page.getByRole('alert')).toContainText('Payment service unavailable')
    expect(requests).toBe(1)
  })
}
