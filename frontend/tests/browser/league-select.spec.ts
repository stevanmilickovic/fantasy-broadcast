import { expect, test, type Page } from '@playwright/test'
import { mockApp } from './fixtures'
import { welcomeLeagueDiscovery } from '../../src/features/public/welcomeDemoData'

test.use({ isMobile: true, hasTouch: true })

async function expectInsideViewport(page: Page) {
  const bounds = await page.getByRole('dialog').boundingBox()
  const viewport = page.viewportSize()
  expect(bounds).not.toBeNull()
  expect(bounds?.x).toBeGreaterThanOrEqual(0)
  expect(bounds?.y).toBeGreaterThanOrEqual(0)
  expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(viewport?.width ?? 0)
  expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeLessThanOrEqual(viewport?.height ?? 0)
}

test('club and gameweek pickers remain inside mobile emulation and support selection and dismissal', async ({
  page,
}, info) => {
  await mockApp(page)
  const entries = Array.from({ length: 30 }, (_, index) => ({
    ...welcomeLeagueDiscovery.details.league_entries[0],
    id: index + 1,
    entry_id: index + 1,
    entry_name: `Club ${index + 1} with a long name`,
    player_first_name: 'Long manager',
    player_last_name: 'name',
  }))
  await page.route('**/draft-overview', (route) =>
    route.fulfill({
      json: {
        ...welcomeLeagueDiscovery,
        gameweek: 24,
        details: {
          ...welcomeLeagueDiscovery.details,
          league_entries: entries,
          matches: Array.from({ length: 38 }, (_, index) => ({
            ...welcomeLeagueDiscovery.details.matches[0],
            id: index + 1,
            event: index + 1,
          })),
        },
      },
    }),
  )
  await page.goto('/league?leagueId=1&view=matchups')
  await page.getByRole('button', { name: 'Gameweek', exact: true }).click()
  await expectInsideViewport(page)
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Gameweek 24', exact: true }),
  ).toBeFocused()
  await page.screenshot({ path: info.outputPath('gameweek-picker.png') })
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL(/week=38/)
  await page.getByRole('button', { name: 'Gameweek', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Gameweek', exact: true })).toBeFocused()
  if ((page.viewportSize()?.width ?? 0) < 960) {
    await page.getByRole('tab', { name: 'Teams', exact: true }).click()
    await page.getByRole('button', { name: 'Club', exact: true }).click()
    await expectInsideViewport(page)
    await page.screenshot({ path: info.outputPath('club-picker.png') })
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /Club 30 with a long name/ })
      .click()
    await expect(page).toHaveURL(/entryId=30/)
    await expect(
      page.getByRole('region', { name: 'Club 30 with a long name players' }),
    ).toBeVisible()
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('gameweek picker finishes its exit before dismissing and respects reduced motion', async ({
  page,
}) => {
  await mockApp(page)
  await page.goto('/league?leagueId=1&view=matchups')
  await page.getByRole('button', { name: 'Gameweek', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Gameweek', exact: true })
  await expect(dialog).toBeVisible()
  const exiting = await dialog.evaluate((element: HTMLDialogElement) => {
    element.dispatchEvent(new Event('cancel', { cancelable: true }))
    return {
      open: element.open,
      animating: element.getAnimations().some((animation) => animation.playState === 'running'),
    }
  })
  expect(exiting).toEqual({ open: true, animating: true })
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Gameweek', exact: true })).toBeFocused()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: 'Gameweek', exact: true }).click()
  const stillOpen = await dialog.evaluate((element: HTMLDialogElement) => {
    element.dispatchEvent(new Event('cancel', { cancelable: true }))
    return element.open
  })
  expect(stillOpen).toBe(false)
  await page.getByRole('button', { name: 'Gameweek', exact: true }).click()
  await dialog.getByRole('button', { name: 'Gameweek 24', exact: true }).click()
  await expect(page).toHaveURL(/week=24/)
})
