import { expect, test } from '@playwright/test'
import { mockBroadcast } from './broadcastFixtures'

for (const totalPoints of [false, true]) {
  test(`${totalPoints ? 'total-points' : 'H2H'} fixture progress uses a subtle live outline and preserves warnings, points and reduced motion`, async ({
    page,
  }) => {
    const { state } = await mockBroadcast(page, totalPoints, (state) => {
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
      players[4].availability = {
        status: 'd',
        chanceOfPlayingThisRound: 50,
        chanceOfPlayingNextRound: 50,
        news: '',
      }
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
    await expect(card(4)).toHaveAttribute('data-availability', 'orange')
    await expect(card(4).locator('.broadcast-fixture-marker')).toHaveCount(0)
    for (const index of [0, 5, 6])
      await expect(card(index).locator('.broadcast-live-outline')).toHaveCount(0)
    const trail = card(4).locator('.broadcast-live-trail')
    const motion = await trail.evaluate((node) => {
      const style = getComputedStyle(node)
      const animation = node.getAnimations()[0]
      if (!animation) throw new Error('Missing live perimeter animation')
      animation.pause()
      animation.currentTime = 0
      const start = getComputedStyle(node).strokeDashoffset
      animation.currentTime = 1250
      const moved = getComputedStyle(node).strokeDashoffset
      animation.play()
      return {
        name: style.animationName,
        duration: style.animationDuration,
        stroke: style.stroke,
        opacity: style.strokeOpacity,
        start,
        moved,
        fill: style.fill,
        width: (node as SVGRectElement).getBBox().width,
        height: (node as SVGRectElement).getBBox().height,
      }
    })
    expect(motion).toMatchObject({
      name: 'broadcast-fixture-live',
      duration: '5s',
      stroke: 'rgb(0, 255, 133)',
      opacity: '0.65',
      fill: 'none',
    })
    expect(motion.start).not.toBe(motion.moved)
    expect(motion.width).toBeGreaterThan(0)
    expect(motion.height).toBeGreaterThan(0)
    await expect(card(4).locator('.broadcast-player-main > .broadcast-live-outline')).toHaveCount(1)
    expect((await card(4).locator('.broadcast-live-outline').boundingBox())!.height).toBeLessThan(
      bounds!.height,
    )
    await page.screenshot({ path: test.info().outputPath('broadcast-live-outline.png') })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    expect(await trail.evaluate((node) => getComputedStyle(node).animationName)).toBe('none')
    expect(await trail.evaluate((node) => getComputedStyle(node).strokeDasharray)).toBe('none')
    expect((await card(4).boundingBox())?.height).toBe(bounds?.height)
    expect((await card(4).boundingBox())?.width).toBe(bounds?.width)
    await page.screenshot({ path: test.info().outputPath('broadcast-fixture-progress.png') })
  })

  test(`${totalPoints ? 'total-points' : 'H2H'} live outline follows the name, points and expanding update`, async ({
    page,
  }) => {
    const { state } = await mockBroadcast(page, totalPoints)
    await page.clock.install()
    await page.goto('/broadcast?leagueId=1')
    await expect(page.locator('.broadcast-scene')).toHaveAttribute('data-phase', 'idle')
    const event = state.events[0]
    const player = page.locator(
      `.broadcast-player[data-manager-id="${event.managerId}"][data-player-id="${event.playerId}"]`,
    )
    const outline = player.locator('.broadcast-player-main > .broadcast-live-outline')
    const expectFittedOutline = async (expanded: boolean) => {
      await expect
        .poll(() =>
          player.evaluate((root, includeUpdate) => {
            const outline = root.querySelector('.broadcast-live-outline')!.getBoundingClientRect()
            const parts = [
              '.broadcast-player-name',
              '.broadcast-player-points',
              ...(includeUpdate ? ['.broadcast-player-event'] : []),
            ].map((selector) => root.querySelector(selector)!.getBoundingClientRect())
            return (
              Math.abs(outline.top - Math.min(...parts.map((rect) => rect.top))) <= 2 &&
              Math.abs(outline.bottom - Math.max(...parts.map((rect) => rect.bottom))) <= 2 &&
              Math.abs(outline.left - Math.min(...parts.map((rect) => rect.left))) <= 2 &&
              Math.abs(outline.right - Math.max(...parts.map((rect) => rect.right))) <= 2
            )
          }, expanded),
        )
        .toBe(true)
    }
    await expect(player).toHaveClass(/has-event/)
    await expect(player.locator('.broadcast-player-event')).toHaveCSS('opacity', '1')
    await expectFittedOutline(true)
    const expandedHeight = (await outline.boundingBox())!.height
    const playerBounds = await player.boundingBox()
    await page.screenshot({ path: test.info().outputPath('live-outline-expanded.png') })
    await page.clock.fastForward(10_001)
    await expect(player).not.toHaveClass(/has-event/)
    await expectFittedOutline(false)
    expect((await outline.boundingBox())!.height).toBeLessThan(expandedHeight)
    expect((await player.boundingBox())!.height).toBe(playerBounds!.height)
    await page.screenshot({ path: test.info().outputPath('live-outline-collapsed.png') })
  })
}
