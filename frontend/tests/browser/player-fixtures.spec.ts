import { expect, test } from '@playwright/test'
import { mockApp } from './fixtures'

test.use({ timezoneId: 'Asia/Tokyo' })

for (const unavailable of [false, true]) {
  test(`player fixtures preserve local times, DGWs, blanks and ${unavailable ? 'missing data' : 'difficulty'}`, async ({
    page,
  }) => {
    await mockApp(page)
    await page.route('**/api/customer/leagues/*/players/*?*', (route) => {
      const url = new URL(route.request().url())
      const gameweek = Number(url.searchParams.get('gameweek'))
      const fixture = {
        id: 500,
        gameweek,
        opponent: 'Liverpool',
        home: true,
        kickoffTime: '2026-10-01T23:30:00Z',
        teamScore: 2,
        opponentScore: 1,
        status: 'FINAL',
        difficulty: 2,
      }
      return route.fulfill({
        json: {
          id: Number(url.pathname.split('/').at(-1)),
          name: 'A player with a long full name',
          shortName: 'Player',
          club: 'Arsenal',
          position: 'MID',
          photoCode: 0,
          gameweek,
          points: unavailable ? null : 9,
          changes: [
            { fixture: 500, stat: 'goals_scored', value: 1, points: 5 },
            { fixture: 501, stat: 'minutes', value: 60, points: 2 },
          ],
          history: [],
          fixtureSchedule: {
            current: unavailable
              ? []
              : [
                  fixture,
                  {
                    ...fixture,
                    id: 501,
                    opponent: 'Tottenham',
                    home: false,
                    status: 'LIVE',
                    difficulty: 4,
                  },
                ],
            upcoming: unavailable
              ? []
              : [
                  {
                    gameweek: 25,
                    fixtures: [
                      {
                        ...fixture,
                        id: 502,
                        gameweek: 25,
                        opponent: 'Chelsea',
                        status: 'SCHEDULED',
                        difficulty: 5,
                        teamScore: null,
                        opponentScore: null,
                      },
                      {
                        ...fixture,
                        id: 503,
                        gameweek: 25,
                        opponent: 'Everton',
                        home: false,
                        difficulty: 1,
                      },
                    ],
                  },
                  { gameweek: 26, fixtures: [] },
                  { gameweek: 27, fixtures: [] },
                  { gameweek: 28, fixtures: [] },
                  { gameweek: 29, fixtures: [] },
                ],
            unscheduled: unavailable
              ? []
              : [
                  {
                    ...fixture,
                    id: 504,
                    gameweek: 0,
                    opponent:
                      'A very long opponent football club name that should wrap within the available dialog width',
                    status: 'TBD',
                    kickoffTime: null,
                    difficulty: null,
                    teamScore: null,
                    opponentScore: null,
                  },
                ],
            unavailableReason: unavailable ? 'FPL fixtures are temporarily unavailable.' : null,
            fetchedAt: new Date().toISOString(),
          },
        },
      })
    })
    await page.goto('/league?leagueId=1&view=teams')
    const trigger = page.getByRole('button', { name: /^View .* points$/ }).first()
    await trigger.click()
    const modal = page.locator('.player-details-modal')
    if (unavailable) {
      await expect(modal).toContainText('FPL fixtures are temporarily unavailable.')
      await expect(modal.locator('.player-details-total')).toContainText('—')
    } else {
      await expect(modal.getByRole('heading', { name: 'Gameweek 24 fixtures' })).toBeVisible()
      await expect(modal).toContainText('Liverpool · Home')
      await expect(modal).toContainText('Tottenham · Away')
      await expect(modal).toContainText('Oct 2')
      await expect(modal).toContainText('GMT+9')
      await expect(modal).toContainText('2–1')
      await expect(modal.getByLabel('Difficulty 5 of 5')).toHaveCount(1)
      await expect(modal.getByLabel('Difficulty unavailable')).toHaveCount(1)
      await expect(
        modal.locator('.player-fixture-week').filter({ hasText: 'GW 26' }),
      ).toContainText('No scheduled fixture')
      await expect(modal).toContainText('Kickoff TBD')
      await expect(modal).toContainText('Gameweek TBD')
      expect(await modal.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true)
      await page.screenshot({ path: test.info().outputPath('player-fixtures.png') })
    }
    await page.getByRole('button', { name: 'Close player details' }).click()
    await expect(modal).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })
}
