import { expect, test } from '@playwright/test'
import { mockApp } from './fixtures'

test('opening a saved league and returning keeps the document and shared navigation mounted', async ({
  page,
}) => {
  const { errors } = await mockApp(page)
  await page.goto('/leagues')
  const marker = await page.evaluate(() => {
    const key = String(Math.random())
    document.documentElement.dataset.navigationMarker = key
    return key
  })
  await page.locator('.league-card').first().click()
  await expect(page.getByRole('tab', { name: 'Standings', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'League', exact: true })).toHaveCount(0)
  expect(await page.locator('html').getAttribute('data-navigation-marker')).toBe(marker)
  await page.locator('.league-back').click()
  await expect(page).toHaveURL('/leagues')
  expect(await page.locator('html').getAttribute('data-navigation-marker')).toBe(marker)
  await page.goBack()
  await expect(page.getByRole('tab', { name: 'Standings', exact: true })).toBeVisible()
  expect(errors).toEqual([])
})
