import { expect, test } from '@playwright/test'
import { mockApp } from './fixtures'

test('home palette stays identical under light/dark preferences and Chromium auto-darkening', async ({
  page,
}) => {
  await mockApp(page, null)
  await page.goto('/')
  await page.addStyleTag({ content: '.welcome-broadcast-stage { visibility: hidden; }' })
  await page.evaluate(() => document.fonts.ready)
  const hero = page.locator('.welcome-hero-copy')
  await expect(hero).toBeVisible()
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  const original = await hero.screenshot({ animations: 'disabled' })
  await page.emulateMedia({ colorScheme: 'dark' })
  expect(await hero.screenshot({ animations: 'disabled' })).toEqual(original)
  const session = await page.context().newCDPSession(page)
  await session.send('Emulation.setAutoDarkModeOverride', { enabled: true })
  expect(await hero.screenshot({ animations: 'disabled' })).toEqual(original)
  await session.detach()
})
