import { expect, test, type Page } from '@playwright/test'
import { welcomeBroadcastState, welcomeShirtCodes } from '../../src/features/public/welcomeDemoData'

async function mockBroadcast(page: Page, totalPoints: boolean) {
  const state = welcomeBroadcastState(0)
  if (totalPoints) state.matchups = []
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const path = new URL(route.request().url()).pathname
      if (path === '/api/auth/me')
        return route.fulfill({ json: { id: 1, email: 'viewer@example.com', role: 'CUSTOMER' } })
      if (path === '/api/live-state') return route.fulfill({ json: state })
      if (path === '/api/customer/fpl/shirts') return route.fulfill({ json: welcomeShirtCodes })
      if (path === '/api/live-state/stream')
        return route.fulfill({ contentType: 'text/event-stream', body: ': connected\n\n' })
      return route.fulfill({ status: 404, json: { detail: 'Unexpected test request: ' + path } })
    },
  )
  await page.route('https://fantasy.premierleague.com/**', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 100"><path fill="#eeeeee" d="M20 5 0 25l15 15 5-5v60h40V35l5 5 15-15L60 5 50 15H30Z"/></svg>',
    }),
  )
  return { state, errors }
}

for (const totalPoints of [false, true]) {
  test(`${totalPoints ? 'total-points' : 'head-to-head'} broadcast reveals and supports manual focus`, async ({
    page,
  }) => {
    const { state, errors } = await mockBroadcast(page, totalPoints)
    await page.goto('/broadcast?leagueId=1')
    const stage = page.getByRole('region', {
      name: totalPoints ? 'Focused total-points club broadcast' : 'Focused matchup broadcast',
    })
    await expect(stage).toBeVisible()
    await expect(page.locator('.matchday-page')).not.toHaveClass(/revealing-match/, {
      timeout: 6000,
    })
    await expect(page.getByRole('navigation', { name: /Ongoing .* selector/ })).toBeVisible()
    const nextTeam = totalPoints ? state.teams[1] : state.matchups[1].home
    await page.locator('.match-chip-track button').nth(1).click()
    await expect(stage.getByRole('heading', { name: new RegExp(nextTeam.clubName) })).toBeVisible()
    await expect(page.locator('.scene-wipe-overlay')).toHaveCount(0, { timeout: 6000 })
    await expect(page.locator('.matchday-page')).not.toHaveClass(/revealing-match/, {
      timeout: 6000,
    })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
    expect(errors).toEqual([])
    await page.screenshot({ path: test.info().outputPath('broadcast.png'), fullPage: true })
  })
}
