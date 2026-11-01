import { expect, test, type Page } from '@playwright/test'
import { mockBroadcast } from './broadcastFixtures'
import { mockApp } from './fixtures'
import {
  welcomeBroadcastState,
  welcomeLeagueDiscovery,
} from '../../src/features/public/welcomeDemoData'
import type { PlayerAvailability } from '../../src/shared/fpl/types'

const scenarios = [
  { status: 'd', chance: 75, severity: 'yellow', color: 'rgb(255, 227, 107)' },
  { status: 'd', chance: 50, severity: 'orange', color: 'rgb(255, 174, 77)' },
  { status: 'd', chance: 25, severity: 'orange', color: 'rgb(255, 174, 77)' },
  { status: 'i', chance: 0, severity: 'red', color: 'rgb(255, 107, 133)' },
  { status: 'a', chance: null, severity: undefined, color: undefined },
  { status: 's', chance: 0, severity: 'red', color: 'rgb(255, 107, 133)' },
  { status: 'u', chance: 0, severity: 'red', color: 'rgb(255, 107, 133)' },
  { status: 'd', chance: 75, severity: 'yellow', color: 'rgb(255, 227, 107)' },
] as const

function availability(index: number): PlayerAvailability {
  const scenario = scenarios[index]
  return {
    status: scenario.status,
    chanceOfPlayingThisRound: scenario.chance,
    chanceOfPlayingNextRound: scenario.chance,
    news: scenario.status === 'a' ? '' : 'Reported availability concern from FPL.',
  }
}

async function mockDetails(
  page: Page,
  players: Array<{ id: string | number; name: string; availability?: PlayerAvailability | null }>,
) {
  await page.route('**/api/customer/leagues/1/players/**', (route) => {
    const id = new URL(route.request().url()).pathname.split('/').at(-1)
    const player = players.find((player) => String(player.id) === id)
    return route.fulfill({
      json: {
        id: Number(id),
        name: player?.name,
        shortName: player?.name,
        club: 'Arsenal',
        position: 'MID',
        photoCode: 0,
        gameweek: 24,
        points: 5,
        changes: [],
        history: [],
        availability: player?.availability,
      },
    })
  })
}

for (const totalPoints of [false, true]) {
  test(`${totalPoints ? 'total-points' : 'H2H'} broadcasts color availability without exposing percentages until player details`, async ({
    page,
  }) => {
    const { state } = await mockBroadcast(page, totalPoints, (state) => {
      const team = state.teams[0]
      const players = [...team.activePlayers.slice(0, 5), ...team.benchPlayers.slice(0, 3)]
      players.forEach((player, index) => {
        player.availability = availability(index)
      })
      state.events[0].managerId = team.managerId
      state.events[0].playerId = players[0].id
      state.events[0].pointDelta = 1
    })
    const team = state.teams[0]
    const players = [...team.activePlayers.slice(0, 5), ...team.benchPlayers.slice(0, 3)]
    await mockDetails(
      page,
      players.map((player) => ({
        id: player.id,
        name: player.displayName,
        availability: player.availability,
      })),
    )
    await page.goto('/broadcast?leagueId=1')
    await expect(page.locator('.broadcast-scene')).toHaveAttribute('data-phase', 'idle')
    const card = (index: number) =>
      page.locator(
        `.broadcast-player[data-manager-id="${team.managerId}"][data-player-id="${players[index].id}"]`,
      )
    for (const [index, scenario] of scenarios.entries()) {
      if (!scenario.severity) {
        expect(await card(index).getAttribute('data-availability')).toBeNull()
        continue
      }
      await expect(card(index)).toHaveAttribute('data-availability', scenario.severity)
      await expect(card(index).locator('.broadcast-player-name')).toHaveCSS(
        'background-color',
        scenario.color,
      )
      await expect(card(index).locator('.broadcast-player-points')).toHaveCSS(
        'background-color',
        scenario.color,
      )
      await expect(card(index).locator('.broadcast-player-points')).toHaveCSS(
        'color',
        'rgb(36, 16, 39)',
      )
      const status = card(index).locator('.broadcast-player-status')
      if (await status.isVisible())
        await expect(status).toHaveCSS('background-color', scenario.color)
    }
    await expect(card(0)).toHaveClass(/has-event/)
    expect((await page.locator('.broadcast-player').allTextContents()).join('')).not.toContain('%')
    await page.screenshot({
      path: test.info().outputPath('broadcast-availability.png'),
      fullPage: true,
    })
    await card(0).click()
    await expect(page.getByRole('region', { name: 'Current availability' })).toContainText(
      '75% chance of playing next gameweek',
    )
    await page.getByRole('button', { name: 'Close player details' }).click()
    await card(4).click()
    const healthy = page.getByRole('region', { name: 'Current availability' })
    await expect(healthy).toContainText('Available')
    await expect(healthy).not.toContainText('%')
    await expect(healthy).not.toContainText('not provided')
  })
}

test('league teams color names while keeping separate points neutral, including bench players', async ({
  page,
}) => {
  await mockApp(page)
  const team = welcomeBroadcastState(0).teams[0]
  const roster = [...team.activePlayers, ...team.benchPlayers]
  const flagged = [0, 1, 2, 3, 4, 11, 12, 13]
  const players = roster.map((player, index) => ({
    id: index + 1,
    webName: player.shortName ?? player.displayName,
    fullName: `Availability Player ${index + 1}`,
    premierLeagueClub: player.premierLeagueClub,
    position: player.position,
    availability: flagged.includes(index) ? availability(flagged.indexOf(index)) : null,
  }))
  const discovery = {
    ...welcomeLeagueDiscovery,
    gameweek: 24,
    players,
    elementStatus: {
      element_status: players.map((player) => ({
        element: player.id,
        owner: 1,
        status: 'o',
        in_accepted_trade: false,
      })),
    },
    entryEvents: {
      '1': {
        picks: players.map((player, index) => ({
          element: player.id,
          position: index + 1,
          multiplier: index < 11 ? 1 : 0,
          starter: index < 11,
          benched: index >= 11,
        })),
      },
    },
  }
  await page.route('**/api/customer/leagues/1/draft-overview', (route) =>
    route.fulfill({ json: discovery }),
  )
  await mockDetails(
    page,
    players.map((player) => ({
      id: player.id,
      name: player.fullName,
      availability: player.availability,
    })),
  )
  await page.goto('/league?leagueId=1&view=teams&entryId=1')
  for (const [index, scenario] of scenarios.entries()) {
    const card = page.getByRole('button', {
      name: new RegExp(`^View Availability Player ${flagged[index] + 1} points`),
    })
    if (!scenario.severity) {
      expect(await card.getAttribute('data-availability')).toBeNull()
      continue
    }
    await expect(card).toHaveAttribute('data-availability', scenario.severity)
    await expect(card.locator('.player-meta strong')).toHaveCSS('background-color', scenario.color)
    await expect(card.locator('.player-meta b')).not.toHaveCSS('background-color', scenario.color)
    await expect(card.locator('.player-meta b')).toHaveCSS('color', 'rgb(255, 255, 255)')
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: test.info().outputPath('league-availability.png'), fullPage: true })
  await page.getByRole('button', { name: /^View Availability Player 2 points/ }).click()
  await expect(page.getByRole('region', { name: 'Current availability' })).toContainText(
    '50% chance of playing next gameweek',
  )
  await page.screenshot({
    path: test.info().outputPath('availability-details.png'),
    fullPage: true,
  })
})
