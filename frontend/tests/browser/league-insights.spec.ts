import { expect, test } from '@playwright/test'
import type { LeagueDiscoveryState } from '../../src/shared/fpl/types'
import { welcomeLeagueDiscovery } from '../../src/features/public/welcomeDemoData'
import { leagues, mockApp } from './fixtures'

function insightFixture(): LeagueDiscoveryState {
  const state = structuredClone(welcomeLeagueDiscovery)
  state.gameweek = 24
  state.livePlayers = []
  state.entryEvents = {}
  state.details.league_entries.forEach((entry) => {
    entry.id += 100
  })
  state.details.standings.forEach((standing, index) => {
    standing.league_entry = index + 101
    standing.points_for = [150, 200, 100, 80][index]
  })
  for (const entry of state.details.league_entries) {
    const picks = []
    for (let index = 0; index < 8; index++) {
      const id = (entry.entry_id - 1) * 8 + index + 1
      state.players.push({
        id,
        webName: `Player ${id}`,
        fullName: `Full Player ${id}`,
        premierLeagueClub: 'Arsenal',
        position: 'MID',
        season: {
          totalPoints: 100 + id,
          goalsScored: id % 4,
          assists: id % 3,
          cleanSheets: id % 2,
        },
      })
      state.elementStatus.element_status.push({
        element: id,
        owner: entry.entry_id,
        status: 'o',
        in_accepted_trade: false,
      })
      picks.push({
        element: id,
        position: index < 6 ? index + 1 : index + 6,
        multiplier: index < 6 ? 1 : 0,
        starter: index < 6,
        benched: index >= 6,
      })
      state.livePlayers.push({
        id,
        stats: {
          minutes: 90,
          totalPoints: id,
          goalsScored: id % 2,
          assists: 0,
          cleanSheets: 0,
          goalsConceded: 0,
          ownGoals: 0,
          penaltiesSaved: 0,
          penaltiesMissed: 0,
          yellowCards: 0,
          redCards: 0,
          saves: 0,
          bonus: 0,
          bps: 0,
        },
      })
    }
    state.entryEvents[String(entry.entry_id)] = { picks }
  }
  return state
}

test('insights filters, player details and club links work without reloading league data', async ({
  page,
}) => {
  const { errors, unexpectedRequests } = await mockApp(page)
  const state = insightFixture()
  let loads = 0
  await page.route('**/draft-overview', (route) => {
    loads++
    return route.fulfill({ json: state })
  })
  await page.goto('/league?leagueId=1&view=insights')
  await expect(page.getByRole('tab', { name: 'Insights' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('heading', { name: 'Scoring vs results' })).toBeVisible()
  await expect(page.getByText('1 place ahead', { exact: true })).toBeVisible()
  await expect(page.getByText('1 place behind', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Player statistic', exact: true }).click()
  await page
    .getByRole('dialog', { name: 'Player statistic', exact: true })
    .getByRole('button', { name: 'Goals', exact: true })
    .click()
  const leaders = page.getByRole('list', { name: 'Goals leaders', exact: true })
  await expect(leaders.locator('li')).toHaveCount(5)
  await page.getByRole('button', { name: /Show all \d+ players/ }).click()
  await expect(leaders.locator('li')).toHaveCount(24)
  await page
    .getByRole('group', { name: 'Player stats period' })
    .getByRole('button', { name: 'Gameweek 24' })
    .click()
  await expect(leaders.locator('li')).toHaveCount(5)
  await leaders.getByRole('button').first().click()
  const modal = page.locator('.player-details-modal')
  await expect(modal).toBeVisible()
  await expect(modal.getByRole('tab', { name: 'Gameweek 24' })).toBeVisible()
  await modal.getByRole('button', { name: 'Close player details' }).click()
  await expect(modal).toHaveCount(0)
  await page.screenshot({ path: test.info().outputPath('league-insights.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page
    .locator('.league-insight-performance')
    .getByRole('link', { name: 'North Bank FC', exact: true })
    .click()
  await expect(page.getByRole('region', { name: 'North Bank FC players' })).toBeVisible()
  await expect(page.locator('.league-team-stage [aria-label="Current starter points"]')).toHaveText(
    '21 pts',
  )
  await expect(page.locator('.league-player-token')).toHaveCount(8)
  expect(loads).toBe(1)
  await page.goBack()
  await expect(page.getByRole('tab', { name: 'Insights' })).toHaveAttribute('aria-selected', 'true')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Your league, in numbers' })).toBeVisible()
  expect(errors).toEqual([])
  expect(unexpectedRequests).toEqual([])
})

test('Classic points insights count shared players once and omit the H2H comparison', async ({
  page,
}) => {
  await mockApp(page)
  const state = insightFixture()
  const entries = state.details.league_entries
  await page.route('**/api/customer/leagues', (route) =>
    route.fulfill({
      json: leagues.map((league) => ({
        ...league,
        leagueType: 'CLASSIC',
        scoringType: 'TOTAL_POINTS',
      })),
    }),
  )
  await page.route('**/api/customer/leagues/*/overview', (route) =>
    route.fulfill({
      json: {
        leagueName: 'Classic league',
        scoringType: 'TOTAL_POINTS',
        gameweek: 24,
        entries: entries.map((entry, index) => ({
          entryId: entry.entry_id,
          entryName: entry.entry_name,
          playerName: entry.player_first_name,
          rank: index + 1,
          total: 200 - index,
          pointsFor: 200 - index,
        })),
        players: state.players,
        livePlayers: state.livePlayers,
        matches: [],
        entryEvents: Object.fromEntries(
          entries.map((entry) => [
            String(entry.entry_id),
            { picks: [{ element: 32, position: 1, multiplier: 1 }] },
          ]),
        ),
      },
    }),
  )
  await page.goto('/league?leagueId=1&view=insights')
  await expect(
    page.getByRole('list', { name: 'Fantasy points leaders' }).locator('li'),
  ).toHaveCount(1)
  await expect(page.getByText('4 clubs · 100% ownership')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Scoring vs results' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Squad output' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('insights show missing data deliberately and fit long club names on narrow screens', async ({
  page,
}) => {
  await mockApp(page)
  const state = insightFixture()
  state.players.forEach((player) => {
    player.season = null
  })
  state.livePlayers = []
  state.details.league_entries[0].entry_name =
    'An unusually long football club name with no reason to break the page'
  await page.route('**/draft-overview', (route) => route.fulfill({ json: state }))
  await page.goto('/league?leagueId=1&view=insights')
  await expect(
    page.getByText('Player statistics are not available for this period yet.'),
  ).toBeVisible()
  await expect(
    page.getByText('Statistics available for 0 of 32 owned players.', { exact: false }),
  ).toBeVisible()
  await expect(page.getByRole('table').locator('tbody td')).toHaveText(Array(12).fill('—'))
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({
    path: test.info().outputPath('league-insights-empty.png'),
    fullPage: true,
  })
})
