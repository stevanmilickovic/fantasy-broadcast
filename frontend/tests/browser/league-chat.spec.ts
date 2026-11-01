import { expect, test } from '@playwright/test'
import { mockApp } from './fixtures'
import type { ChatMessage } from '../../src/features/chat/api'

test('league chat works without FPL data, preserves failed drafts and always shows sender emails', async ({
  page,
}) => {
  await mockApp(page)
  let sends = 0
  const ids: string[] = []
  const messages: ChatMessage[] = [
    {
      id: '1',
      leagueId: 1,
      userId: 2,
      displayName: 'Same name',
      email: 'one@example.com',
      body: '<img src=x onerror=alert(1)>',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    },
    {
      id: '2',
      leagueId: 1,
      userId: 3,
      displayName: 'Same name',
      email: 'two@example.com',
      body: 'Hello league',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    },
  ]
  await page.route('**/api/customer/leagues/1/draft-overview', (route) =>
    route.fulfill({ status: 503, json: { message: 'FPL unavailable' } }),
  )
  await page.route('**/api/customer/leagues/1/chat*', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON()
      ids.push(body.sendId)
      if (++sends === 1) return route.fulfill({ status: 503, json: { message: 'Send failed' } })
      const message = { ...messages[0], id: '3', body: body.body }
      messages.push(message)
      return route.fulfill({ json: message })
    }
    return route.fulfill({
      json: { messages, hasOlder: false, hasMore: false, serverTime: new Date().toISOString() },
    })
  })
  await page.goto('/league?leagueId=1&view=chat')
  await expect(page.getByRole('tab', { name: 'Chat', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.getByText('Hello league', { exact: true })).toBeVisible()
  await expect(page.locator('.chat-messages img')).toHaveCount(0)
  await expect(page.getByText('one@example.com', { exact: true })).toBeVisible()
  await expect(page.getByText('two@example.com', { exact: true })).toBeVisible()
  await expect(page.locator('.chat-author-email').first()).toHaveCSS('color', 'rgb(163, 160, 168)')
  await expect(page.locator('.chat-author button')).toHaveCount(0)
  await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Test message')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toHaveValue(
    'Test message',
  )
  await expect(page.getByRole('alert')).toContainText('Send failed')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page.getByText('Test message', { exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toHaveValue('')
  expect(ids[0]).toBe(ids[1])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
})
