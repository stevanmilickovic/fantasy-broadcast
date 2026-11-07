import { expect, test } from '@playwright/test'
import { mockApp } from './fixtures'

for (const [label, plan] of [
  ['Choose Standard', 'STANDARD'],
  ['Choose AI Broadcaster', 'AI_BROADCASTER'],
] as const) {
  test(`${label} guides to unobscured consent before creating checkout`, async ({ page }) => {
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
    await page.goto('/leagues/checkout?fplLeagueId=42&leagueType=DRAFT')
    await expect(page.getByLabel('League verified', { exact: true })).toBeVisible()
    const button = page.getByRole('button', { name: label, exact: true })
    await expect(button).toBeEnabled()
    await button.click()
    const checkbox = page.getByRole('checkbox')
    await expect(checkbox).toBeFocused()
    await expect(checkbox).not.toBeChecked()
    await expect(checkbox).toHaveAttribute('aria-invalid', 'true')
    await expect(page.locator('.checkout-consent')).toHaveAttribute('data-required', 'true')
    await expect(page.locator('.notification-host')).toContainText('accept the terms')
    const box = await checkbox.boundingBox()
    const notice = await page.locator('.notification-host').boundingBox()
    const consentLabel = await page.locator('.checkout-consent label').boundingBox()
    expect(box).not.toBeNull()
    expect(notice).not.toBeNull()
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThan(notice?.y ?? 0)
    expect((consentLabel?.y ?? 0) + (consentLabel?.height ?? 0)).toBeLessThan(notice?.y ?? 0)
    expect(
      await checkbox.evaluate((node) => {
        const rect = node.getBoundingClientRect()
        return document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === node
      }),
    ).toBe(true)
    expect(requests).toBe(0)
    await page.screenshot({ path: test.info().outputPath(`consent-${plan}.png`) })
    await checkbox.check()
    await expect(checkbox).toHaveAttribute('aria-invalid', 'false')
    await expect(page.locator('#checkout-consent-error')).toHaveCount(0)
    expect(requests).toBe(0)
    await button.click()
    await expect(page.getByRole('alert')).toContainText('Payment service unavailable')
    expect(requests).toBe(1)
  })
}
