import { expect, test } from '@playwright/test'
import { mockBroadcast } from './broadcastFixtures'

for (const totalPoints of [false, true]) {
  test(`${totalPoints ? 'club' : 'matchup'} strip scrolls, pauses at the end and returns without fighting interaction`, async ({
    page,
  }) => {
    await mockBroadcast(page, totalPoints, (state) => {
      // Scoring notifications change chip widths; this check isolates scroll timing.
      state.events = []
      if (totalPoints)
        state.teams = Array.from({ length: 32 }, (_, i) => ({
          ...state.teams[i % state.teams.length],
          managerId: `club-${i}`,
        }))
      else
        state.matchups = Array.from({ length: 32 }, (_, i) => ({
          ...state.matchups[i % state.matchups.length],
          id: `match-${i}`,
        }))
    })
    const clockStart = new Date('2026-11-08T12:00:00Z')
    await page.clock.install({ time: clockStart })
    await page.clock.pauseAt(new Date(clockStart.getTime() + 60_000))
    await page.goto('/broadcast?leagueId=1')
    const track = page.locator('.match-chip-track')
    await expect(track).toBeVisible()
    const offset = () => track.evaluate((element) => element.scrollLeft)
    await page.clock.runFor(4000)
    expect(await offset()).toBeGreaterThan(20)

    if (page.viewportSize()!.width > 1050) {
      expect(await track.evaluate((element) => getComputedStyle(element).scrollbarColor)).toBe(
        'rgba(0, 0, 0, 0) rgba(0, 0, 0, 0)',
      )
      await track.hover()
      const hoveredOffset = await offset()
      await page.clock.runFor(1000)
      expect(await offset()).toBe(hoveredOffset)
      expect(await track.evaluate((element) => getComputedStyle(element).scrollbarColor)).not.toBe(
        'rgba(0, 0, 0, 0) rgba(0, 0, 0, 0)',
      )
      await page.mouse.move(0, 0)
    }

    await track.evaluate((element) => {
      element.scrollLeft = element.scrollWidth - element.clientWidth - 3
      element.dispatchEvent(new WheelEvent('wheel'))
    })
    const manualOffset = await offset()
    await page.clock.runFor(1000)
    expect(await offset()).toBe(manualOffset)
    await page.clock.runFor(5500)
    const endOffset = await offset()
    expect(endOffset).toBeGreaterThan(manualOffset)
    await page.clock.runFor(1000)
    expect(await offset()).toBe(endOffset)
    await page.clock.runFor(2500)
    expect(await offset()).toBeLessThan(endOffset - 10)

    await track.locator('button').first().focus()
    const focusedOffset = await offset()
    await page.clock.runFor(1000)
    expect(await offset()).toBe(focusedOffset)
    await track
      .locator('button')
      .first()
      .evaluate((button) => button.blur())
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const reducedOffset = await offset()
    await page.clock.runFor(9000)
    expect(await offset()).toBe(reducedOffset)

    const scrollbar = await track.evaluate((element) => getComputedStyle(element).scrollbarWidth)
    if (page.viewportSize()!.width <= 1050) expect(scrollbar).toBe('none')
    await expect(page.locator('.broadcast-controls')).toBeInViewport()
  })
}

test('five-player formation columns retain jersey size and may extend beyond the pitch', async ({
  page,
}) => {
  await mockBroadcast(page, false, (state) => {
    state.teams.forEach((team, teamIndex) => {
      team.activePlayers.forEach((player, index) => {
        player.position =
          index === 0
            ? 'GKP'
            : index <= (teamIndex % 2 ? 5 : 4)
              ? 'DEF'
              : index <= 8
                ? 'MID'
                : 'FWD'
      })
    })
  })
  await page.goto('/broadcast?leagueId=1')
  await expect(page.locator('.broadcast-scene')).toHaveAttribute('data-phase', 'idle')
  const sizes = await page.locator('.broadcast-squad').evaluateAll((squads) =>
    squads.map((squad) => ({
      shirt: squad.querySelector('.broadcast-shirt')!.getBoundingClientRect().height,
      overflow: getComputedStyle(squad.querySelector('.broadcast-starters')!).overflowY,
    })),
  )
  expect(sizes).toHaveLength(2)
  expect(Math.abs(sizes[0].shirt - sizes[1].shirt)).toBeLessThan(2)
  if (page.viewportSize()!.width > 1050) {
    expect(sizes[1].overflow).toBe('visible')
  }
  await page.screenshot({ path: test.info().outputPath('dense-formation.png') })
})
