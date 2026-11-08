import { expect, test } from '@playwright/test'
import { welcomeLeagueDiscovery } from '../../src/features/public/welcomeDemoData'
import { leagues, mockApp } from './fixtures'

test('live standings preserve URL choice and current matchups retain scores on stale updates', async ({
  page,
}) => {
  const { errors, unexpectedRequests } = await mockApp(page)
  await page.clock.install()
  const state = { ...structuredClone(welcomeLeagueDiscovery), gameweek: 24 }
  const [one, two] = state.details.league_entries
  state.details.matches = [
    {
      id: 900,
      event: 24,
      league_entry_1: one.id,
      league_entry_2: two.id,
      league_entry_1_points: 0,
      league_entry_2_points: 0,
      finished: false,
    },
  ]
  await page.route('**/draft-overview', (route) => route.fulfill({ json: state }))
  let fail = false
  let requests = 0
  await page.route(`**/api/customer/leagues/${leagues[0].id}/live`, (route) => {
    requests++
    if (fail)
      return route.fulfill({ status: 503, json: { message: 'FPL is temporarily unavailable.' } })
    return route.fulfill({
      json: {
        source: 'DRAFT',
        gameweek: 24,
        pointsFetchedAt: new Date().toISOString(),
        fixturesFetchedAt: new Date().toISOString(),
        status: 'LIVE',
        baselineGameweek: 23,
        managerScores: { [one.id]: 72, [two.id]: 34 },
        matchups: [
          {
            id: 900,
            event: 24,
            firstManagerId: String(one.id),
            secondManagerId: String(two.id),
            firstPoints: 72,
            secondPoints: 34,
            status: 'LIVE',
          },
        ],
        standings: [
          {
            teamId: String(two.id),
            teamName: two.entry_name,
            managerName: two.player_first_name,
            position: 1,
            total: 30,
            gameweekPoints: 34,
            pointsFor: 500,
          },
          {
            teamId: String(one.id),
            teamName: one.entry_name,
            managerName: one.player_first_name,
            position: 2,
            total: 27,
            gameweekPoints: 72,
            pointsFor: 480,
          },
        ],
        scoresUnavailableReason: null,
        standingsUnavailableReason: null,
      },
    })
  })
  await page.goto(`/league?leagueId=${leagues[0].id}`)
  await expect(page.getByRole('button', { name: 'FPL', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: 'Live', exact: true }).click()
  await expect(page.locator('.league-table tbody tr').first()).toContainText(two.entry_name)
  await expect(
    page.getByRole('img', { name: 'Provisional · Gameweek 24: Win, 72–34' }),
  ).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('button', { name: 'FPL', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: 'Live', exact: true }).click()
  await page.getByRole('tab', { name: 'Matchups', exact: true }).click()
  await expect(page).toHaveURL(new RegExp('view=matchups&standings=live'))
  await expect(page.locator('.league-matchup-card')).toContainText('72')
  await expect(page.locator('.league-matchup-card')).toContainText('34')
  await page.screenshot({ path: test.info().outputPath('live-matchups.png'), fullPage: true })
  fail = true
  await page.clock.fastForward(11_000)
  await expect(page.locator('.league-live-status')).toContainText('stale')
  await expect(page.locator('.league-matchup-card')).toContainText('72')
  const previousRequests = requests
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.clock.fastForward(30_000)
  expect(requests).toBe(previousRequests)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect.poll(() => requests).toBeGreaterThan(previousRequests)
  expect(errors).toEqual([])
  expect(unexpectedRequests).toEqual([])
})
