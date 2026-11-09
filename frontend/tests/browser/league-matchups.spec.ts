import { expect, test } from '@playwright/test'
import { mockApp } from './fixtures'
import { welcomeLeagueDiscovery } from '../../src/features/public/welcomeDemoData'

for (const id of [undefined, 0]) {
  test(`week navigation replaces matchups with ${id === undefined ? 'missing' : 'repeated'} FPL match IDs`, async ({
    page,
  }) => {
    const { errors } = await mockApp(page)
    const consoleErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    const match = (event: number, first: number, second: number, points: number) => ({
      id,
      event,
      league_entry_1: first,
      league_entry_2: second,
      league_entry_1_points: points,
      league_entry_2_points: 0,
      finished: event < 24,
    })
    await page.route('**/draft-overview', (route) =>
      route.fulfill({
        json: {
          ...welcomeLeagueDiscovery,
          gameweek: 24,
          details: {
            ...welcomeLeagueDiscovery.details,
            matches: [
              match(23, 1, 3, 23),
              match(24, 1, 2, 24),
              match(24, 3, 4, 25),
              match(25, 1, 4, 0),
            ],
          },
        },
      }),
    )
    await page.goto('/league?leagueId=1&view=matchups')
    const scores = page.locator('.league-matchup-club > strong')
    const cards = page.locator('.league-matchup-card')
    await expect(cards).toHaveCount(2)
    await expect(scores).toHaveText(['24', '0', '25', '0'])
    for (let visit = 0; visit < 2; visit++) {
      await page.getByRole('button', { name: 'Previous gameweek' }).click()
      await expect(page).toHaveURL(/week=23/)
      await expect(cards).toHaveCount(1)
      await expect(scores).toHaveText(['23', '0'])
      await page.getByRole('button', { name: 'Next gameweek' }).click()
      await expect(cards).toHaveCount(2)
      await expect(scores).toHaveText(['24', '0', '25', '0'])
    }
    await page.getByRole('button', { name: 'Next gameweek' }).click()
    await expect(cards).toHaveCount(1)
    await expect(scores).toHaveText(['—', '—'])
    await expect(cards.locator('.winner, .loser')).toHaveCount(0)
    await page.goBack()
    await expect(cards).toHaveCount(2)
    await expect(scores).toHaveText(['24', '0', '25', '0'])
    expect(errors).toEqual([])
    expect(consoleErrors).toEqual([])
  })
}
