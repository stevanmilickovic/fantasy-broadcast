import { expect, test, type Page } from '@playwright/test'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { mockApp } from './fixtures'

async function demoLogos(page: Page, missing?: string) {
  await page.route('**/demo-logos/*.png', (route) =>
    new URL(route.request().url()).pathname.endsWith(`/${missing}.png`)
      ? route.fulfill({ status: 404, body: '' })
      : route.fulfill({
          contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="#20e6ff" d="M8 4h48v34L32 60 8 38Z"/></svg>',
        }),
  )
}

test('homepage preview uses static club logos in matchups and standings without a league API', async ({
  page,
}) => {
  const { errors, unexpectedRequests } = await mockApp(page, null)
  await demoLogos(page)
  await page.goto('/')
  const preview = page.locator('.welcome-real-broadcast')
  const emblems = preview.locator('.broadcast-identity > .team-emblem')
  await expect(emblems).toHaveCount(2)
  await expect(emblems.nth(0)).toHaveAttribute('src', '/demo-logos/north-bank.png')
  await expect(emblems.nth(1)).toHaveAttribute('src', '/demo-logos/toulouse.png')
  if ((page.viewportSize()?.width ?? 1920) <= 700) {
    await expect(preview).toBeHidden()
    return
  }
  await expect(preview.locator('.broadcast-scene')).toHaveAttribute('data-phase', 'idle')
  await expect(emblems.first()).toBeVisible()
  expect(
    await emblems.first().evaluate((node: HTMLImageElement) => node.naturalWidth),
  ).toBeGreaterThan(0)
  await preview.getByRole('button', { name: 'Standings', exact: true }).click()
  const standings = preview.getByRole('region', { name: 'Live leaderboard' })
  await expect(standings.locator('.team-emblem')).toHaveCount(4)
  for (const [club, filename] of [
    ['North Bank FC', 'north-bank'],
    ['Expected Toulouse', 'toulouse'],
    ['No Fuchs Given', 'fuchs'],
    ['Bonus Point Wanderers', 'wanderers'],
  ]) {
    await expect(
      standings.getByRole('row', { name: new RegExp(club) }).locator('img'),
    ).toHaveAttribute('src', `/demo-logos/${filename}.png`)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  )
  await page.screenshot({ path: test.info().outputPath('welcome-emblems.png'), fullPage: true })
  expect(errors).toEqual([])
  expect(unexpectedRequests).toEqual([])
})

test('missing preview logos are hidden while club names and the other logos remain', async ({
  page,
}) => {
  const { errors } = await mockApp(page, null)
  await demoLogos(page, 'toulouse')
  await page.goto('/')
  const preview = page.locator('.welcome-real-broadcast')
  await expect(preview.locator('.broadcast-identity > .team-emblem')).toHaveCount(1)
  await expect(preview.locator('.broadcast-identity.away h2')).toHaveText('Expected Toulouse')
  if ((page.viewportSize()?.width ?? 1920) <= 700) {
    await expect(preview).toBeHidden()
    return
  }
  await preview.getByRole('button', { name: 'Standings', exact: true }).click()
  const standings = preview.getByRole('region', { name: 'Live leaderboard' })
  await expect(standings.locator('.team-emblem')).toHaveCount(3)
  await expect(standings.getByRole('row', { name: /Expected Toulouse/ })).toBeVisible()
  expect(errors).toEqual([])
})

test('provided PNGs load directly from the built homepage', async ({ page }) => {
  const filenames = ['north-bank', 'toulouse', 'fuchs', 'wanderers']
  test.skip(
    !filenames.every((name) => existsSync(resolve('public/demo-logos', `${name}.png`))),
    'Artwork has not been added yet.',
  )
  const { errors, unexpectedRequests } = await mockApp(page, null)
  await page.goto('/')
  const preview = page.locator('.welcome-real-broadcast')
  const emblems = preview.locator('.broadcast-identity > .team-emblem')
  await expect(emblems).toHaveCount(2)
  await expect
    .poll(() =>
      emblems.evaluateAll((nodes) =>
        nodes.every(
          (node) => node instanceof HTMLImageElement && node.complete && node.naturalWidth > 0,
        ),
      ),
    )
    .toBe(true)
  if ((page.viewportSize()?.width ?? 1920) <= 700) {
    await expect(preview).toBeHidden()
    return
  }
  await expect(preview.locator('.broadcast-scene')).toHaveAttribute('data-phase', 'idle')
  await page.screenshot({ path: test.info().outputPath('welcome-real-logos.png'), fullPage: true })
  await preview.getByRole('button', { name: 'Standings', exact: true }).click()
  const logos = preview.locator('.broadcast-standings .team-emblem')
  await expect(logos).toHaveCount(4)
  await expect
    .poll(() =>
      logos.evaluateAll((nodes) =>
        nodes.every(
          (node) => node instanceof HTMLImageElement && node.complete && node.naturalWidth > 0,
        ),
      ),
    )
    .toBe(true)
  expect(errors).toEqual([])
  expect(unexpectedRequests).toEqual([])
})
