import { expect, test } from '@playwright/test'
import { mockApp, viewer } from './fixtures'

test('account settings places Back above the form and stays usable with long account details', async ({
  page,
}) => {
  await mockApp(page, {
    ...viewer,
    email: 'an.extremely.long.account.address.for.mobile.testing@example.com',
  })
  await page.goto('/account')
  const back = page.getByRole('button', { name: 'Back', exact: true })
  const form = page.locator('.account-card')
  await expect(back).toBeVisible()
  const backBounds = await back.boundingBox()
  expect(backBounds?.y).toBeLessThan(64)
  const formBounds = await form.boundingBox()
  expect((backBounds?.y ?? 0) + (backBounds?.height ?? 0)).toBeLessThan(formBounds?.y ?? 0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expect(page.getByRole('textbox', { name: 'Username', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save username', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Your follow requests' })).toHaveCount(0)
  await page.screenshot({ path: test.info().outputPath('account-settings.png'), fullPage: true })
  await back.click()
  await expect(page).toHaveURL('/leagues')
})
