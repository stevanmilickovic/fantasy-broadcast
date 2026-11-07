import { expect, test } from '@playwright/test'
import { mockApp } from './fixtures'

test('homepage publishes a readable search summary and crawlable brand icons without JavaScript', async ({
  request,
}) => {
  const home = await request.get('/')
  expect(home.ok()).toBe(true)
  const html = await home.text()
  expect(html).toContain(
    'Fantasy Broadcast turns your FPL Draft or Classic league into a live matchday broadcast with scores, standings and real-time updates.',
  )
  expect(html).toMatch(/<meta\s+name="description"/)
  expect(html).toContain('href="/favicon.png"')
  expect(html).toContain('href="/favicon.ico"')

  const png = await request.get('/favicon.png')
  expect(png.ok()).toBe(true)
  expect(png.headers()['content-type']).toContain('image/png')
  const pixels = await png.body()
  expect(pixels.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  expect(pixels.readUInt32BE(16)).toBe(96)
  expect(pixels.readUInt32BE(20)).toBe(96)

  const ico = await request.get('/favicon.ico')
  expect(ico.ok()).toBe(true)
  expect((await ico.body()).subarray(0, 6).toString('hex')).toBe('000001000100')

  const robots = await request.get('/robots.txt')
  expect(robots.ok()).toBe(true)
  expect(robots.headers()['content-type']).toContain('text/plain')
  expect(await robots.text()).toMatch(/User-agent: \*\s+Allow: \/\s*$/)
})

test('feature cards and demo fixtures stay visible but are excluded from search snippets', async ({
  page,
}) => {
  const { errors, unexpectedRequests } = await mockApp(page, null)
  await page.goto('/')
  await expect(page).toHaveTitle('Fantasy Broadcast')
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    /FPL Draft or Classic league.*live matchday broadcast/,
  )
  const features = page.locator('.welcome-features')
  await expect(features).toHaveAttribute('data-nosnippet', '')
  await expect(features.getByRole('heading', { name: 'Bring your league' })).toBeVisible()
  await expect(page.locator('.welcome-real-broadcast')).toHaveAttribute('data-nosnippet', '')
  expect(errors).toEqual([])
  expect(unexpectedRequests).toEqual([])
})
