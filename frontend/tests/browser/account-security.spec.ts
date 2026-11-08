import { expect, test } from '@playwright/test'
import { mockApp } from './fixtures'

test('password change returns to sign-in and deletion stays in the account area', async ({
  page,
}) => {
  const { errors, unexpectedRequests } = await mockApp(page)
  let changed = false
  await page.route('**/api/auth/password/change', (route) => {
    expect(route.request().postDataJSON()).toEqual({
      currentPassword: 'old-password-123',
      password: 'new-password-123',
    })
    changed = true
    return route.fulfill({ status: 204 })
  })
  await page.goto('/leagues')
  await expect(
    page.locator('.legal-footer').getByRole('button', { name: 'Delete account' }),
  ).toHaveCount(0)
  await page.goto('/account')
  await expect(
    page.getByText('Changing your password signs out all existing sessions.', { exact: false }),
  ).toHaveCount(0)
  await page.getByLabel('Current password', { exact: true }).fill('old-password-123')
  await page.getByLabel('New password', { exact: true }).fill('new-password-123')
  await page.getByLabel('Confirm new password', { exact: true }).fill('new-password-123')
  await page.getByRole('button', { name: 'Show current password' }).click()
  await expect(page.getByLabel('Current password', { exact: true })).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Change password', exact: true }).click()
  await expect(page).toHaveURL('/login')
  await expect(page.locator('.notification-host')).toContainText('Please sign in again')
  expect(changed).toBe(true)
  expect(errors).toEqual([])
  expect(unexpectedRequests).toEqual([])
})

test('Google-only settings and deletion deep links do not depend on leagues', async ({ page }) => {
  await mockApp(page)
  await page.route('**/api/auth/password/capability', (route) =>
    route.fulfill({ json: { hasPassword: false } }),
  )
  let leagueRequests = 0
  await page.route('**/api/customer/leagues', (route) => {
    leagueRequests++
    return route.fulfill({ status: 503, json: {} })
  })
  await page.route('**/api/auth/account-deletion-request', (route) =>
    route.fulfill({ json: { message: 'Deletion request received for review.' } }),
  )
  await page.goto('/account')
  await expect(page.getByText(/You sign in with Google/)).toBeVisible()
  await expect(page.getByLabel('Current password')).toHaveCount(0)
  await page.getByRole('button', { name: 'Delete account', exact: true }).click()
  await expect(page).toHaveURL('/account-deletion')
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Request account deletion', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('received for review')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Request account deletion' })).toBeVisible()
  expect(leagueRequests).toBe(0)
})
