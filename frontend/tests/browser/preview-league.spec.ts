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
  if (info.project.name === 'phone') {
    const bubbles = await page
      .locator('.league-form-column .league-form-bubble')
      .evaluateAll((items) =>
        items.map((bubble) => {
          const range = document.createRange()
          range.selectNodeContents(bubble)
          const letter = range.getBoundingClientRect()
          const circle = bubble.getBoundingClientRect()
          return {
            offset: letter.top + letter.height / 2 - (circle.top + circle.height / 2),
            lineHeight: getComputedStyle(bubble).lineHeight,
          }
        }),
      )
    const offsets = bubbles.map((bubble) => bubble.offset)
    expect(bubbles.every((bubble) => bubble.lineHeight === '12px')).toBe(true)
    expect(Math.max(...offsets) - Math.min(...offsets)).toBeLessThanOrEqual(0.5)
    const first = page.getByRole('table').locator('tbody tr').first()
    await expect(first.locator('.league-standings-identity small')).toBeHidden()
    const geometry = await first.evaluate((row) => {
      const name = row.querySelector('.league-team-link span')!.getBoundingClientRect()
      const rank = row.querySelector('.league-rank')!.getBoundingClientRect()
      const movement = row
        .querySelector('.league-mobile-detail .league-movement')!
        .getBoundingClientRect()
      const crest = row.querySelector('.team-emblem')!
      const form = row.querySelector('.league-form-column')!
      const image = row.querySelector('td:nth-child(3) button')!.getBoundingClientRect()
      const points = row.querySelector('td:last-child strong')!.getBoundingClientRect()
      return {
        nameRight: name.right,
        movementRightOfRank: movement.left >= rank.right,
        movementAligned: movement.top < rank.bottom && rank.top < movement.bottom,
        crestOpacity: Number(getComputedStyle(crest).opacity),
        crestHeightDifference: Math.abs(
          crest.getBoundingClientRect().height - row.getBoundingClientRect().height,
        ),
        formGap: Number.parseFloat(
          getComputedStyle(form.querySelector('.league-recent-form')!).columnGap,
        ),
        imageFormGap:
          form.querySelector('.league-form-bubble')!.getBoundingClientRect().left - image.right,
        formLeft: form.getBoundingClientRect().left,
        scoreInset: row.getBoundingClientRect().right - points.right,
        imageLeft: image.left,
        imageRight: image.right,
        imageHeight: image.height,
      }
    })
    expect(geometry.movementRightOfRank && geometry.movementAligned).toBe(true)
    expect(geometry.crestOpacity).toBeLessThan(0.5)
    expect(geometry.crestHeightDifference).toBeLessThanOrEqual(1)
    expect(geometry.formGap).toBeGreaterThanOrEqual(2)
    expect(geometry.imageFormGap).toBeGreaterThanOrEqual(6)
    expect(geometry.imageLeft).toBeGreaterThan(geometry.nameRight)
    expect(geometry.formLeft).toBeGreaterThanOrEqual(geometry.imageRight)
    expect(geometry.scoreInset).toBeGreaterThanOrEqual(10)
    expect(geometry.imageHeight).toBeGreaterThanOrEqual(44)
  }
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
