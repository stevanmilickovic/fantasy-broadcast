import { expect, test } from '@playwright/test'
import { mockBroadcast } from './broadcastFixtures'

test('fixture progress preserves warning hues, points, geometry and reduced motion', async ({
  page,
}) => {
  const { state } = await mockBroadcast(page, false, (state) => {
    state.events = []
    const players = state.teams[0].activePlayers
    for (const [index, severity] of [null, 75, 50, 0].entries()) {
      players[index].fixtureProgress = 'UPCOMING'
      players[index].points = 0
      players[index].minutes = 0
      players[index].availability =
        severity === null
          ? null
          : {
              status: severity === 0 ? 'i' : 'd',
              chanceOfPlayingThisRound: severity,
              chanceOfPlayingNextRound: severity,
              news: '',
            }
    }
    players[4].fixtureProgress = 'LIVE'
    players[4].minutes = 0
    players[4].points = 0
    players[5].fixtureProgress = 'COMPLETE'
    players[6].fixtureProgress = 'BETWEEN'
    players[6].points = 7
  })
  const team = state.teams[0]
  await page.goto('/broadcast?leagueId=1')
  await expect(page.locator('.broadcast-scene')).toHaveAttribute('data-phase', 'idle')
  const card = (index: number) =>
    page.locator(
      `.broadcast-player[data-manager-id="${team.managerId}"][data-player-id="${team.activePlayers[index].id}"]`,
    )
  for (let index = 0; index < 4; index++) {
    await expect(card(index)).toHaveAttribute('data-fixture-progress', 'UPCOMING')
    await expect(card(index).locator('.broadcast-player-points')).toHaveText('–')
    expect(
      await card(index)
        .locator('.broadcast-shirt img, .broadcast-shirt svg')
        .evaluate((node) => getComputedStyle(node).opacity),
    ).toBe('0.62')
    expect(await card(index).evaluate((node) => getComputedStyle(node).opacity)).toBe('1')
  }
  for (const index of [1, 2, 3]) {
    expect(
      await card(index)
        .locator('.broadcast-player-name')
        .evaluate((node) => getComputedStyle(node).backgroundColor),
    ).toContain('color(srgb')
    expect(
      await card(index)
        .locator('.broadcast-player-name')
        .evaluate((node) => getComputedStyle(node).color),
    ).toBe('rgb(36, 16, 39)')
  }
  await expect(card(4)).toHaveAccessibleDescription('Team playing now')
  await expect(card(4).locator('.broadcast-player-points')).toHaveText('0')
  await expect(card(6).locator('.broadcast-player-points')).toHaveText('7')
  await expect(card(6)).toHaveAccessibleDescription('Another club fixture remains this gameweek')
  const bounds = await card(4).boundingBox()
  expect(
    await card(4)
      .locator('.broadcast-player-main')
      .evaluate((node) => getComputedStyle(node, '::before').animationName),
  ).toBe('broadcast-fixture-live')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(
    await card(4)
      .locator('.broadcast-player-main')
      .evaluate((node) => getComputedStyle(node, '::before').animationName),
  ).toBe('none')
  expect((await card(4).boundingBox())?.height).toBe(bounds?.height)
  expect((await card(4).boundingBox())?.width).toBe(bounds?.width)
  await page.screenshot({ path: test.info().outputPath('broadcast-fixture-progress.png') })
})
