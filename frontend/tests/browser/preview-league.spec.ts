import { expect, test } from '@playwright/test'

test('a signed-out visitor can browse the preview league and watch the replay', async ({
  page,
}, info) => {
  if (info.project.name === 'phone') await page.setViewportSize({ width: 320, height: 740 })
  const requests: string[] = []
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/me') return route.fulfill({ status: 401, json: {} })
    requests.push(path)
    return route.fulfill({ status: 404, json: {} })
  })
  await page.route('https://fantasy.premierleague.com/dist/img/shirts/**', (route) =>
    route.fulfill({ status: 404 }),
  )
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.install()
  await page.goto('/')
  await page.getByRole('link', { name: 'Preview league', exact: true }).click()
  await expect(page).toHaveURL('/preview-league')
  await expect(page.getByRole('heading', { name: 'Sunday League Elite' })).toBeVisible()
  await expect(page.getByRole('tab')).toHaveCount(3)
  await expect(page.getByRole('img', { name: 'Gameweek 2: Draw, 49–49' })).toHaveCount(2)
  await expect(page.getByRole('table')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({
    path: info.outputPath('preview-league.png'),
    fullPage: true,
    animations: 'disabled',
  })

  await page.getByRole('button', { name: 'Create standings image' }).click()
  const image = page.getByRole('dialog', { name: 'League standings' })
  await expect(image).toContainText('Sample results')
  await image.getByRole('button', { name: /Story/ }).click()
  await expect(image.getByRole('button', { name: /Story/ })).toHaveAttribute('aria-pressed', 'true')
  if (info.project.name === 'laptop') {
    const download = image.getByRole('button', { name: 'Download PNG' })
    await expect(download).toBeEnabled({ timeout: 15_000 })
    const [file] = await Promise.all([page.waitForEvent('download'), download.click()])
    expect(file.suggestedFilename()).toMatch(/-standings-gw3-story\.png$/)
  }
  await image.getByRole('button', { name: 'Close image preview' }).click()
  await expect(
    page.getByRole('button', { name: 'Create club image for North Bank FC' }),
  ).toBeEnabled()

  await page.getByRole('link', { name: 'North Bank FC', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'North Bank FC' })).toBeVisible()
  await page.getByRole('button', { name: 'View Thiago points' }).click()
  const player = page.getByRole('dialog')
  await expect(player.getByRole('tabpanel')).toContainText('13 pts')
  await expect(player.getByRole('tabpanel')).toContainText('Goals × 2')
  await player.getByRole('tab', { name: 'Previous gameweeks' }).click()
  await expect(player.getByRole('tabpanel')).toContainText('Gameweek 2')
  await expect(player.getByRole('tabpanel')).toContainText('Gameweek 1')
  await player.getByRole('button', { name: 'Close player details' }).click()

  await page.getByRole('tab', { name: 'Matchups' }).click()
  for (const week of [3, 2, 1]) {
    await expect(page.getByRole('button', { name: 'Gameweek', exact: true })).toContainText(
      `Gameweek ${week}`,
    )
    await expect(page.getByText('Final', { exact: true })).toHaveCount(2)
    if (week > 1) await page.getByRole('button', { name: 'Previous gameweek' }).click()
  }
  await expect(page.getByRole('button', { name: 'Previous gameweek' })).toBeDisabled()
  await expect(page.getByRole('button', { name: /^Create matchup image for/ })).toHaveCount(2)
  await page.getByRole('button', { name: 'Create gameweek matchups image' }).click()
  const matchupsImage = page.getByRole('dialog', { name: 'Gameweek matchups' })
  await expect(matchupsImage).toContainText('Sample results')
  await expect(matchupsImage.getByText('GW 1', { exact: true })).toBeVisible()
  await matchupsImage.getByRole('button', { name: 'Close image preview' }).click()

  await page.getByRole('button', { name: 'Watch demo broadcast' }).click()
  await expect(page).toHaveURL('/preview-league?view=broadcast')
  await expect(page.getByText('Demo', { exact: true })).toBeVisible()
  await expect(page.getByText('Gameweek 4', { exact: true })).toBeVisible()
  const commentary = page.getByRole('complementary', { name: 'Broadcast updates' })
  await expect(commentary).toContainText('Saka')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath('demo-replay.png'), animations: 'disabled' })
  await page.clock.fastForward(12_100)
  await expect(commentary).toContainText('Palmer')
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page).toHaveURL('/preview-league')
  await expect(page.getByRole('tab', { name: 'Standings' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  expect(requests).toEqual([])
})
