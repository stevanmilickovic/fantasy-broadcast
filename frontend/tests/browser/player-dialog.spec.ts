import { expect, test } from '@playwright/test'
import { mockApp } from './fixtures'

for (const context of ['league', 'broadcast']) {
  test(`player dialog animates dismissal and restores focus in ${context}`, async ({ page }) => {
    await mockApp(page)
    await page.goto(
      context === 'league' ? '/league?leagueId=1&view=teams' : '/broadcast?leagueId=1',
    )
    if (context === 'broadcast')
      await expect(page.locator('.matchday-page')).not.toHaveClass(/revealing-match/, {
        timeout: 6000,
      })
    const player = page.getByRole('button', { name: /^View .* points$/ }).first()
    await player.click()
    const dialog = page.locator('.player-details-modal')
    await expect(dialog).toBeVisible()
    const exiting = await dialog.evaluate((element: HTMLDialogElement) => {
      element.dispatchEvent(new Event('cancel', { cancelable: true }))
      return {
        open: element.open,
        animating: element.getAnimations().some((animation) => animation.playState === 'running'),
      }
    })
    expect(exiting).toEqual({ open: true, animating: true })
    await expect(dialog).toHaveCount(0)
    await expect(player).toBeFocused()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await player.click()
    await expect(dialog).toBeVisible()
    expect(await dialog.evaluate((element) => element.getAnimations().length)).toBe(0)
    await page.getByRole('button', { name: 'Close player details' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(player).toBeFocused()
  })
}
