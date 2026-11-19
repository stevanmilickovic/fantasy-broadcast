import { expect, test } from '@playwright/test'
import { mockApp } from './fixtures'

test('workspace landmarks distinguish collection discovery registration checkout and account', async ({
  page,
}) => {
  await mockApp(page)
  await page.goto('/leagues')
  const workspace = page.getByRole('navigation', { name: 'League workspace' })
  await expect(workspace.getByRole('link', { name: 'My leagues', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(page.getByRole('heading', { name: 'My leagues' })).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('01-collection.png'), fullPage: true })
  await workspace.getByRole('link', { name: 'Find leagues', exact: true }).click()
  await expect(workspace.getByRole('link', { name: 'Find leagues', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(page.getByRole('searchbox', { name: 'League name or ID' })).toBeVisible()
  expect(
    await page
      .locator('.customer-league-discovery')
      .evaluate((node) => getComputedStyle(node).backgroundColor),
  ).toBe('rgba(0, 0, 0, 0)')
  await page.screenshot({ path: test.info().outputPath('02-discovery.png'), fullPage: true })
  await workspace.getByRole('link', { name: 'Register', exact: true }).click()
  await expect(workspace.getByRole('link', { name: 'Register', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await page.getByRole('textbox', { name: 'FPL league ID' }).fill('42')
  await page.screenshot({ path: test.info().outputPath('03-register.png'), fullPage: true })
  await expect(page.getByLabel('League verified')).toBeVisible()
  await expect(page.getByRole('radio', { name: /Standard/ })).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('04-checkout.png'), fullPage: true })
  await page.getByLabel('Account menu').click()
  await page.getByRole('button', { name: 'Account settings', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Account settings' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sign-in and security' })).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('05-account.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
