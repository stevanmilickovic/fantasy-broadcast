import { expect, test } from '@playwright/test'
import { mockBroadcast } from './broadcastFixtures'

test('broadcast chat fades recent messages and reveals readable history without moving the pitch', async ({
  page,
}) => {
  await mockBroadcast(page)
  await page.route('**/api/customer/leagues/1/chat*', (route) =>
    route.fulfill({
      json: {
        messages: Array.from({ length: 50 }, (_, index) => ({
          id: String(index + 1),
          leagueId: 1,
          userId: 1,
          displayName: 'A long player username shared with others',
          email: 'player@example.com',
          body: `Message ${index + 1}: Hello league`,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        })),
        hasOlder: false,
        hasMore: false,
        serverTime: new Date().toISOString(),
      },
    }),
  )
  await page.goto('/broadcast?leagueId=1')
  await expect(page.locator('.broadcast-scene')).toHaveAttribute('data-phase', 'idle')
  const before = await page.locator('.broadcast-squad').first().boundingBox()
  await page.getByRole('button', { name: 'Open league chat' }).click()
  const dialog = page.getByRole('dialog', { name: 'League chat', exact: true })
  await expect(dialog).toBeVisible()
  await expect(page.getByText('Message 50: Hello league', { exact: true })).toBeVisible()
  const list = page.locator('.chat-message-area')
  expect(await list.evaluate((node) => getComputedStyle(node).maskImage)).toContain(
    'linear-gradient',
  )
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeVisible()
  const bounds = await page.locator('.chat-composer').boundingBox()
  expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeLessThanOrEqual(page.viewportSize()!.height)
  await list.evaluate((node) => {
    node.scrollTop = 0
    node.dispatchEvent(new Event('scroll'))
  })
  await expect(dialog).toHaveAttribute('data-history', 'true')
  await expect(list).toHaveCSS('mask-image', 'none')
  await expect(page.getByText('Message 1: Hello league', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Back to latest', exact: true }).click()
  await expect(dialog).toHaveAttribute('data-history', 'false')
  if (test.info().project.name === 'phone') {
    await page.evaluate(() => {
      if (!window.visualViewport) throw new Error('Missing visual viewport')
      Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 360 })
      window.visualViewport.dispatchEvent(new Event('resize'))
    })
    const composer = await page.locator('.chat-composer').boundingBox()
    expect((composer?.y ?? 0) + (composer?.height ?? 0)).toBeLessThanOrEqual(360)
    await page.evaluate(() => {
      if (!window.visualViewport) return
      Object.defineProperty(window.visualViewport, 'height', {
        configurable: true,
        value: window.innerHeight,
      })
      window.visualViewport.dispatchEvent(new Event('resize'))
    })
  }
  await page.screenshot({ path: test.info().outputPath('broadcast-chat.png'), fullPage: true })
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Open league chat' })).toBeFocused()
  const after = await page.locator('.broadcast-squad').first().boundingBox()
  expect(after).toEqual(before)
})
