import { expect, test } from '@playwright/test'
import { mockBroadcast } from './broadcastFixtures'

test('a full broadcast shows the viewer limit and retries only when requested', async ({
  page,
}) => {
  const { errors } = await mockBroadcast(page)
  await page.goto('/broadcast?leagueId=1')
  await expect(page.locator('.broadcast-scene')).toHaveAttribute('data-phase', 'idle')
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent('broadcast-test-full', {
        detail:
          'This broadcast has reached its limit of 50 simultaneous viewers. Try again when a space opens.',
      }),
    ),
  )
  await expect(page.getByText(/limit of 50 simultaneous viewers/)).toBeVisible()
  await expect(page.locator('.broadcast-scene')).toHaveCount(0)
  await expect(page.locator('html')).toHaveAttribute('data-broadcast-stream', 'closed')
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.locator('.broadcast-scene')).toHaveAttribute('data-phase', 'idle')
  await expect(page.locator('html')).toHaveAttribute('data-broadcast-stream', 'open')
  expect(errors).toEqual([])
})

for (const totalPoints of [false, true]) {
  test(`${totalPoints ? 'club' : 'matchup'} selector buttons align with Back and Multi above their scrollbar`, async ({
    page,
  }) => {
    await mockBroadcast(page, totalPoints, (state) => {
      if (totalPoints)
        state.teams = Array.from({ length: 32 }, (_, i) => ({
          ...state.teams[i % state.teams.length],
          managerId: `club-${i}`,
          clubName: `Broadcast club ${i + 1}`,
        }))
      else
        state.matchups = Array.from({ length: 32 }, (_, i) => ({
          ...state.matchups[i % state.matchups.length],
          id: `match-${i}`,
        }))
    })
    await page.goto('/broadcast?leagueId=1')
    await expect(page.locator('.broadcast-scene')).toHaveAttribute('data-phase', 'idle')
    await expect(page.getByRole('button', { name: 'Multi', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Auto', exact: true })).toHaveCount(0)
    const viewport = page.locator('.broadcast-chip-viewport')
    if (!(await viewport.isVisible())) return
    const geometry = await page.locator('.broadcast-controls').evaluate((controls) => {
      const back = controls.querySelector('.broadcast-back')
      const multi = controls.querySelector('.broadcast-auto')
      const track = controls.querySelector<HTMLElement>('.match-chip-track')
      const chip = track?.querySelector('button')
      if (!back || !multi || !track || !chip) throw new Error('Missing broadcast controls')
      return {
        back: back.getBoundingClientRect().toJSON(),
        multi: multi.getBoundingClientRect().toJSON(),
        chip: chip.getBoundingClientRect().toJSON(),
        scrollBottom: track.getBoundingClientRect().bottom,
        overflows: track.scrollWidth > track.clientWidth,
      }
    })
    expect(Math.abs(geometry.back.top - geometry.chip.top)).toBeLessThanOrEqual(1)
    expect(Math.abs(geometry.multi.bottom - geometry.chip.bottom)).toBeLessThanOrEqual(1)
    expect(geometry.overflows).toBe(true)
    expect(geometry.scrollBottom).toBeGreaterThan(geometry.back.bottom)
  })
}

test('AI commentary uses icons with no repeated visible label', async ({ page }) => {
  const { state } = await mockBroadcast(page)
  await page.goto('/broadcast?leagueId=1')
  await expect(page.locator('.broadcast-caption')).toBeVisible()
  await expect(
    page.getByRole('img', { name: 'AI-generated commentary', exact: true }),
  ).toBeVisible()
  await expect(page.getByText('AI-generated commentary', { exact: true })).toHaveCount(0)
  await expect(page.locator('.broadcast-caption')).toContainText(state.commentary[0].text)
})

test('without AI commentary, the speaker row is absent but scoring details remain available', async ({
  page,
}) => {
  await mockBroadcast(page, false, (state) => {
    state.commentary = []
  })
  await page.goto('/broadcast?leagueId=1')
  await expect(page.locator('.broadcast-scene')).toHaveAttribute('data-phase', 'idle')
  await expect(page.locator('.broadcast-caption')).toHaveCount(0)
  await expect(page.locator('.broadcast-commentary-icons')).toHaveCount(0)
  await expect(page.getByText('Waiting for the next update.')).toHaveCount(0)
  await expect(page.locator('.broadcast-event-line')).toContainText('GOAL')
  await page.getByRole('button', { name: 'Read full broadcast update' }).click()
  await expect(page.getByRole('dialog', { name: 'Broadcast update' })).toContainText('GOAL')
})

test('without commentary or events, the broadcast has no empty update bar', async ({ page }) => {
  await mockBroadcast(page, false, (state) => {
    state.commentary = []
    state.events = []
  })
  await page.goto('/broadcast?leagueId=1')
  await expect(page.locator('.broadcast-scene')).toHaveAttribute('data-phase', 'idle')
  await expect(page.locator('.broadcast-event-rail')).toHaveCount(0)
})
