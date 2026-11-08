import { expect, test } from '@playwright/test'
import { leagues, mockApp, viewer } from './fixtures'

test('removal requires confirmation and preserves membership on failure', async ({ page }) => {
  await mockApp(page, { ...viewer, id: 20 })
  const league = { ...leagues[0], privateLeague: true }
  let removed = false
  let requests = 0
  await page.route('**/api/customer/leagues', (route) =>
    route.fulfill({ json: removed ? [] : [league] }),
  )
  await page.route(`**/api/customer/leagues/${league.id}/follow`, (route) => {
    requests++
    if (requests === 1)
      return route.fulfill({ status: 503, json: { detail: 'Please retry removal.' } })
    removed = true
    return route.fulfill({ status: 204 })
  })
  await page.goto(`/league?leagueId=${league.id}`)
  await expect(page.locator('.league-back')).toHaveText('My leagues')
  const open = async () => {
    await page.getByLabel('League actions').click()
    await page.getByRole('button', { name: 'Remove from my leagues' }).click()
  }
  await open()
  const dialog = page.getByRole('dialog', { name: `Remove ${league.displayName}?` })
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
  await expect(dialog).toContainText('require the owner’s approval')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).not.toBeVisible()
  expect(requests).toBe(0)
  await expect(page.getByLabel('League actions')).toBeFocused()
  await open()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  expect(requests).toBe(0)
  await open()
  await dialog.getByRole('button', { name: 'Remove league', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Please retry removal.')
  await expect(page).toHaveURL(`/league?leagueId=${league.id}`)
  await dialog.getByRole('button', { name: 'Remove league', exact: true }).click()
  await expect(page).toHaveURL('/leagues')
  await expect(page.getByRole('heading', { name: 'My leagues' })).toBeVisible()
  expect(requests).toBe(2)
})
