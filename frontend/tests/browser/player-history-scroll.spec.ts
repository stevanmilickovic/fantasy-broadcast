import { expect, test } from '@playwright/test'
import { mockApp } from './fixtures'
import { mockBroadcast } from './broadcastFixtures'

for (const context of ['league', 'broadcast']) {
  test(`player history owns the only scroll area in ${context}`, async ({ page }, info) => {
    if (context === 'broadcast') await mockBroadcast(page)
    else await mockApp(page)
    await page.route('**/api/customer/leagues/*/players/*?*', (route) => {
      const url = new URL(route.request().url())
      return route.fulfill({
        json: {
          id: Number(url.pathname.split('/').at(-1)),
          gameweek: Number(url.searchParams.get('gameweek')),
          name: 'A football player with a long full name',
          shortName: 'Player',
          club: 'Arsenal',
          position: 'MID',
          photoCode: 0,
          points: 9,
          availability: {
            status: 'd',
            chanceOfPlayingThisRound: 75,
            chanceOfPlayingNextRound: 75,
            news: 'A long fitness update that must remain readable within the available space. '.repeat(
              6,
            ),
          },
          changes: Array.from({ length: 15 }, (_, fixture) => ({
            fixture,
            stat: 'minutes',
            value: 60,
            points: 2,
          })),
          history: Array.from({ length: 37 }, (_, index) => ({
            gameweek: index + 1,
            points: index % 10,
          })),
        },
      })
    })
    await page.goto(
      context === 'league' ? '/league?leagueId=1&view=teams' : '/broadcast?leagueId=1',
    )
    if (context === 'broadcast')
      await expect(page.locator('.matchday-page')).not.toHaveClass(/revealing-match/, {
        timeout: 6000,
      })
    const background = await page.evaluate(() => ({
      html: getComputedStyle(document.documentElement).overflowY,
      body: getComputedStyle(document.body).overflowY,
    }))
    const trigger = page.getByRole('button', { name: /^View .* points$/ }).first()
    await trigger.click()
    const dialog = page.locator('.player-details-modal')
    await dialog.getByRole('tab', { name: 'Previous gameweeks' }).click()
    const history = dialog.getByRole('tabpanel')
    await expect(history).toContainText('Gameweek 37')
    await dialog.evaluate(async (root) => {
      await Promise.all(
        root.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
      )
    })
    const checkScrollOwner = async () => {
      const dimensions = await dialog.evaluate((root) => {
        const panel = root.querySelector('.player-details-list')!
        const content = root.querySelector('.player-details-content')!
        const scrolling = [root, ...root.querySelectorAll('*')].filter(
          (element) =>
            ['auto', 'scroll'].includes(getComputedStyle(element).overflowY) &&
            element.scrollHeight > element.clientHeight + 1,
        )
        const rect = root.getBoundingClientRect()
        return {
          onlyPanelScrolls: scrolling.length === 1 && scrolling[0] === panel,
          dialogFits:
            root.scrollHeight <= root.clientHeight + 1 &&
            content.scrollHeight <= content.clientHeight + 1,
          inside: rect.top >= 15 && rect.bottom <= innerHeight - 15,
          bodyLocked:
            getComputedStyle(document.body).overflowY === 'hidden' &&
            getComputedStyle(document.documentElement).overflowY === 'hidden',
        }
      })
      expect(dimensions).toEqual({
        onlyPanelScrolls: true,
        dialogFits: true,
        inside: true,
        bodyLocked: true,
      })
      await history.evaluate((element) => {
        element.scrollTop = element.scrollHeight
      })
      await expect(history.getByText('Gameweek 1', { exact: true })).toBeInViewport()
    }
    await checkScrollOwner()
    if (info.project.name === 'phone') {
      for (const [width, height] of [
        [320, 568],
        [360, 640],
        [640, 360],
      ]) {
        await page.setViewportSize({ width, height })
        await checkScrollOwner()
      }
    }
    await page.screenshot({ path: test.info().outputPath('player-history-single-scroll.png') })
    await dialog.getByRole('tab', { name: /^Gameweek \d+$/ }).click()
    await expect(dialog.getByRole('tabpanel')).toContainText('Total')
    expect(await dialog.getByRole('tabpanel').evaluate((element) => element.scrollTop)).toBe(0)
    await page.getByRole('button', { name: 'Close player details' }).click()
    await expect(dialog).toHaveCount(0)
    expect(
      await page.evaluate(() => ({
        html: getComputedStyle(document.documentElement).overflowY,
        body: getComputedStyle(document.body).overflowY,
      })),
    ).toEqual(background)
    await expect(trigger).toBeFocused()
  })
}
