import { expect, test } from '@playwright/test'
import { mockApp, leagues } from './fixtures'
import { welcomeLeagueDiscovery } from '../../src/features/public/welcomeDemoData'

test('league view links survive refresh and back, with keyboard tabs and a default club', async ({
  page,
}) => {
  await mockApp(page)
  await page.goto('/league?leagueId=1')
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'League points' })).toBeVisible()
  await page.getByRole('tab', { name: 'Teams', exact: true }).click()
  await expect(page.getByRole('region', { name: 'North Bank FC players' })).toBeVisible()
  await expect(page).toHaveURL(/view=teams/)
  await page.reload()
  await expect(page.getByRole('region', { name: 'North Bank FC players' })).toBeVisible()
  await page.getByRole('tab', { name: 'Teams', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Matchups' })).toBeFocused()
  await expect(page.getByRole('tab', { name: 'Matchups' })).toHaveAttribute('aria-selected', 'true')
  await page.goBack()
  await expect(page.getByRole('tab', { name: 'Teams', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await page.locator('.profile-menu summary').click()
  await page.keyboard.press('Escape')
  await expect(page.locator('.profile-menu')).not.toHaveAttribute('open')
})

test('historical gameweeks remain selectable and final zero scores remain visible', async ({
  page,
}) => {
  await mockApp(page)
  await page.route('**/draft-overview', (route) =>
    route.fulfill({
      json: {
        ...welcomeLeagueDiscovery,
        gameweek: 24,
        details: {
          ...welcomeLeagueDiscovery.details,
          matches: [
            {
              id: 1,
              event: 23,
              league_entry_1: 1,
              league_entry_2: 2,
              league_entry_1_points: 0,
              league_entry_2_points: 0,
              finished: true,
            },
            {
              id: 2,
              event: 24,
              league_entry_1: 1,
              league_entry_2: 2,
              league_entry_1_points: 4,
              league_entry_2_points: 3,
              finished: false,
            },
            { id: 3, event: 25, league_entry_1: 1, league_entry_2: 2, finished: false },
          ],
        },
      },
    }),
  )
  await page.goto('/league?leagueId=1&view=matchups')
  await page.getByRole('button', { name: 'Previous gameweek' }).click()
  await expect(page).toHaveURL(/week=23/)
  await expect(page.locator('.league-matchup-club strong')).toHaveText(['0', '0'])
  await page.getByRole('button', { name: 'Gameweek', exact: true }).click()
  await page
    .getByRole('dialog', { name: 'Gameweek', exact: true })
    .getByRole('button', { name: 'Gameweek 25', exact: true })
    .click()
  await expect(page.locator('.league-matchup-club strong')).toHaveText(['—', '—'])
})

test('matchup cards keep clubs on opposite sides of centered scores', async ({ page }) => {
  const { errors, unexpectedRequests } = await mockApp(page)
  await page.route('**/draft-overview', (route) =>
    route.fulfill({
      json: {
        ...welcomeLeagueDiscovery,
        gameweek: 24,
        details: {
          ...welcomeLeagueDiscovery.details,
          league_entries: welcomeLeagueDiscovery.details.league_entries.map((entry, index) => ({
            ...entry,
            entry_name:
              index === 0 ? 'A very long football club name that stays readable' : entry.entry_name,
          })),
          matches: [
            {
              id: 1,
              event: 24,
              league_entry_1: 1,
              league_entry_2: 2,
              league_entry_1_points: 1234,
              league_entry_2_points: 987,
              finished: true,
            },
            {
              id: 2,
              event: 24,
              league_entry_1: 3,
              league_entry_2: 4,
              league_entry_1_points: -1,
              league_entry_2_points: 0,
              finished: true,
            },
            {
              id: 3,
              event: 24,
              league_entry_1: 1,
              league_entry_2: 3,
              league_entry_1_points: 0,
              league_entry_2_points: 0,
              finished: true,
            },
            {
              id: 4,
              event: 24,
              league_entry_1: 2,
              league_entry_2: 4,
              league_entry_1_points: 45,
              league_entry_2_points: 20,
              finished: false,
            },
          ],
        },
      },
    }),
  )
  await page.goto('/league?leagueId=1&view=matchups')
  const cards = page.locator('.league-matchup-card')
  await expect(cards).toHaveCount(4)
  await expect(cards.first().locator('.winner strong')).toHaveText('1234')
  await expect(cards.nth(1).locator('.winner strong')).toHaveText('0')
  await expect(cards.locator('header')).toHaveCount(0)
  await expect(cards.locator('small').filter({ hasText: 'Winner' })).toHaveCount(0)
  await expect(cards.nth(2).locator('.winner, .loser')).toHaveCount(0)
  await expect(cards.nth(3).locator('.winner strong')).toHaveText('45')
  await expect(cards.nth(3).locator('.loser strong')).toHaveText('20')
  for (const card of await cards.all()) {
    const positions = await card.evaluate((element) => {
      const bounds = (selector: string) => {
        const target = element.querySelector(selector)
        if (!target) throw new Error(`Missing matchup element: ${selector}`)
        return target.getBoundingClientRect()
      }
      const firstName = bounds('.first-club a')
      const firstScore = bounds('.first-club strong')
      const secondName = bounds('.second-club a')
      const secondScore = bounds('.second-club strong')
      const card = element.getBoundingClientRect()
      const center = card.x + card.width / 2
      return {
        leftNameBeforeScore:
          firstName.right <= firstScore.left || firstName.bottom <= firstScore.top,
        scoresInOrder: firstScore.right <= center && center <= secondScore.left,
        rightNameAfterScore:
          secondScore.right <= secondName.left || secondName.bottom <= secondScore.top,
        scoresAligned: Math.abs(firstScore.y - secondScore.y) < 1,
        centerOffset: Math.abs((firstScore.right + secondScore.left) / 2 - center),
        fits: element.scrollWidth <= element.clientWidth,
      }
    })
    expect(positions).toMatchObject({
      leftNameBeforeScore: true,
      scoresInOrder: true,
      rightNameAfterScore: true,
      scoresAligned: true,
      fits: true,
    })
    expect(positions.centerOffset).toBeLessThan(1)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: test.info().outputPath('matchup-scorecards.png'), fullPage: true })
  if (test.info().project.name === 'phone') {
    await page.setViewportSize({ width: 320, height: 640 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(
      await cards.evaluateAll((elements) =>
        elements.every((element) => element.scrollWidth <= element.clientWidth),
      ),
    ).toBe(true)
    await page.screenshot({
      path: test.info().outputPath('matchup-scorecards-narrow.png'),
      fullPage: true,
    })
  }
  expect(errors).toEqual([])
  expect(unexpectedRequests).toEqual([])
})

test('Classic total points keeps long names and large totals readable, with unsupported tabs rejected', async ({
  page,
}) => {
  await mockApp(page)
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
        entries: [
          {
            entryId: 1,
            entryName: 'A very long football club name that must remain readable',
            playerName: 'A long manager name',
            rank: 1,
            lastRank: 2,
            total: 12345,
            pointsFor: 12345,
          },
        ],
        matches: [],
        players: [],
        entryEvents: {},
        livePlayers: [],
      },
    }),
  )
  await page.goto('/league?leagueId=1&view=matchups')
  await expect(page.getByRole('tab', { name: 'Standings' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.getByRole('tab', { name: 'Matchups' })).toHaveCount(0)
  await expect(page.getByRole('columnheader', { name: 'Total points' })).toBeVisible()
  await expect(page.getByRole('cell', { name: '12345', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('link', { name: /A very long football club/ }).click()
  await expect(page.getByRole('region', { name: /A very long football club/ })).toBeVisible()
  await expect(page.getByText('No squad available for this club.')).toBeVisible()
})

test('broadcast availability failure can be retried without hiding league data', async ({
  page,
}) => {
  await mockApp(page)
  let failed = true
  await page.route('**/broadcast-schedules/active', (route) =>
    route.fulfill(
      failed
        ? { status: 503, json: { detail: 'Unavailable' } }
        : { json: [{ id: 1, startsAt: '2026-10-28T00:00:00Z', endsAt: '2026-10-28T23:59:00Z' }] },
    ),
  )
  await page.goto('/league?leagueId=1')
  await expect(page.getByRole('table')).toBeVisible()
  await expect(
    page.getByText('Broadcast availability unavailable.', { exact: false }),
  ).toBeVisible()
  failed = false
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Open broadcast', exact: true })).toBeVisible()
  await expect(page.getByRole('table')).toBeVisible()
})

test('narrow screens preserve controls and names with reduced motion', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'Additional narrow-phone stress check')
  await mockApp(page)
  await page.setViewportSize({ width: 320, height: 640 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/league?leagueId=1&view=teams')
  await expect(page.getByRole('button', { name: 'Club', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'North Bank FC players' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const tabs = await page.getByRole('tab').all()
  const tops = await Promise.all(tabs.map(async (tab) => (await tab.boundingBox())?.y))
  expect(new Set(tops).size).toBe(1)
})

for (const type of ['DRAFT', 'CLASSIC'] as const) {
  test(`${type} supports the other scoring mode`, async ({ page }) => {
    await mockApp(page)
    const scoringType = type === 'DRAFT' ? 'TOTAL_POINTS' : 'H2H'
    await page.route('**/api/customer/leagues', (route) =>
      route.fulfill({
        json: leagues.map((league) => ({ ...league, leagueType: type, scoringType })),
      }),
    )
    if (type === 'CLASSIC') {
      await page.route('**/api/customer/leagues/*/overview', (route) =>
        route.fulfill({
          json: {
            leagueName: 'Classic head to head',
            scoringType,
            gameweek: 24,
            entries: [
              {
                entryId: 1,
                entryName: 'Classic Club',
                playerName: 'Manager',
                rank: 1,
                total: 42,
                pointsFor: 1234,
              },
            ],
            entryEvents: {},
            players: [],
            livePlayers: [],
            matches: [],
          },
        }),
      )
    }
    await page.goto('/league?leagueId=1')
    await expect(
      page.getByRole('columnheader', { name: type === 'DRAFT' ? 'Total points' : 'League points' }),
    ).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Matchups' })).toHaveCount(type === 'DRAFT' ? 0 : 1)
  })
}

test('club links switch to the selected team without reloading the document or league data', async ({
  page,
}) => {
  await mockApp(page)
  let overviewRequests = 0
  let documentRequests = 0
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('/draft-overview')) overviewRequests++
  })
  await page.goto('/league?leagueId=1')
  await expect(page.getByRole('table')).toBeVisible()
  await page.evaluate(() => {
    document.documentElement.dataset.navigationMarker = 'same-document'
  })
  page.on('request', (request) => {
    if (request.isNavigationRequest()) documentRequests++
  })
  await page.getByRole('link', { name: 'Expected Toulouse', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Expected Toulouse players' })).toBeVisible()
  await expect(page).toHaveURL(/view=teams&entryId=2/)
  await page.goBack()
  await expect(page.getByRole('table')).toBeVisible()
  await page.getByRole('tab', { name: 'Matchups', exact: true }).click()
  await page.getByRole('link', { name: 'Expected Toulouse', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Expected Toulouse players' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.dataset.navigationMarker)).toBe(
    'same-document',
  )
  expect(documentRequests).toBe(0)
  expect(overviewRequests).toBe(1)
})
