import { expect, test } from '@playwright/test'
import { welcomeLeagueDiscovery } from '../../src/features/public/welcomeDemoData'
import { leagues, mockApp } from './fixtures'

for (const leagueType of ['DRAFT', 'CLASSIC'] as const) {
  test(`${leagueType} standings show five final results with the newest on the right`, async ({
    page,
  }) => {
    const { errors, unexpectedRequests } = await mockApp(page)
    const state = structuredClone(welcomeLeagueDiscovery)
    state.details.league_entries.forEach((entry) => {
      entry.id += 100
    })
    state.details.standings.forEach((standing) => {
      standing.league_entry = (standing.league_entry ?? 0) + 100
    })
    state.details.league_entries[0].entry_name =
      'A very long football club name that stays readable'
    state.details.matches = [7, 4, 1, 6, 3, 5, 2].map((event) => ({
      id: event,
      event,
      league_entry_1: 101,
      league_entry_2: 102,
      league_entry_1_points: event,
      league_entry_2_points: 4,
      finished: event < 7,
    }))
    await page.route('**/api/customer/leagues', (route) =>
      route.fulfill({
        json: leagues.map((league) => ({ ...league, leagueType, scoringType: 'H2H' })),
      }),
    )
    if (leagueType === 'DRAFT') {
      await page.route('**/draft-overview', (route) => route.fulfill({ json: state }))
    } else {
      await page.route('**/api/customer/leagues/*/overview', (route) =>
        route.fulfill({
          json: {
            leagueName: 'Classic H2H',
            scoringType: 'H2H',
            gameweek: 7,
            entries: state.details.league_entries.map((entry, index) => ({
              entryId: entry.entry_id,
              entryName: entry.entry_name,
              playerName: entry.player_first_name,
              rank: index + 1,
              total: 30,
              pointsFor: 400,
            })),
            matches: state.details.matches.map((match) => ({
              event: match.event,
              finished: match.finished,
              firstEntryId: 1,
              secondEntryId: 2,
              firstPoints: match.league_entry_1_points,
              secondPoints: match.league_entry_2_points,
            })),
            players: [],
            livePlayers: [],
            entryEvents: {},
          },
        }),
      )
    }
    await page.goto('/league?leagueId=1')
    const rows = page.getByRole('table').locator('tbody tr')
    await expect(page.getByRole('columnheader', { name: 'Form', exact: true })).toBeVisible()
    const formCell = rows.first().locator('td.league-form-column')
    const form = formCell.getByRole('group', { name: 'Recent form' })
    await expect(
      rows.first().locator('td').nth(1).getByRole('group', { name: 'Recent form' }),
    ).toHaveCount(0)
    await expect(form.locator('.league-form-bubble')).toHaveText(['L', 'L', 'D', 'W', 'W'])
    await expect(
      form.getByRole('img', { name: 'Gameweek 4: Draw, 4–4', exact: true }),
    ).toBeVisible()
    await expect(rows.nth(1).locator('.league-form-bubble')).toHaveText(['W', 'W', 'D', 'L', 'L'])
    await expect(rows.nth(2).getByText('No completed results')).toBeVisible()
    await expect(page.getByRole('img', { name: /Gameweek 7:/ })).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: test.info().outputPath('standings-form.png'), fullPage: true })
    if (test.info().project.name === 'phone') {
      await page.setViewportSize({ width: 320, height: 640 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      )
      await expect(
        form.getByRole('img', { name: 'Gameweek 6: Win, 6–4', exact: true }),
      ).toBeVisible()
      const bubbleTops = await form
        .getByRole('img')
        .evaluateAll((bubbles) => bubbles.map((bubble) => bubble.getBoundingClientRect().top))
      expect(new Set(bubbleTops).size).toBe(1)
    }
    expect(errors).toEqual([])
    expect(unexpectedRequests).toEqual([])
  })
}
