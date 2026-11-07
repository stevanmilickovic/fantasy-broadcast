import { expect, test } from '@playwright/test'
import { mockApp, viewer } from './fixtures'

test('a username conflict preserves the draft and a subsequent save persists', async ({ page }) => {
  await mockApp(page)
  let current = viewer
  await page.route('**/api/auth/me', async (route) => {
    if (route.request().method() !== 'PATCH') return route.fulfill({ json: current })
    const name = route.request().postDataJSON().displayName
    if (name === 'Taken')
      return route.fulfill({ status: 409, json: { message: 'That username is already taken.' } })
    current = { ...current, displayName: name }
    return route.fulfill({ json: current })
  })
  await page.goto('/account')
  const name = page.getByRole('textbox', { name: 'Username', exact: true })
  await name.fill('Taken')
  await page.getByRole('button', { name: 'Save username' }).click()
  await expect(page.getByRole('alert')).toContainText('already taken')
  await expect(name).toHaveValue('Taken')
  await name.fill('My unique username')
  await page.getByRole('button', { name: 'Save username' }).click()
  await expect(page.getByRole('status')).toContainText('Username saved')
  await page.reload()
  await expect(name).toHaveValue('My unique username')
})

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
