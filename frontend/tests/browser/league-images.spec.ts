import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { leagues, mockApp } from './fixtures'
import { welcomeLeagueDiscovery } from '../../src/features/public/welcomeDemoData'

async function downloadImage(page: import('@playwright/test').Page, height: number, name: string) {
  const button = page.getByRole('button', { name: 'Download PNG', exact: true })
  await expect(button).toBeEnabled({ timeout: 20000 })
  const overflow = await page.locator('.league-art').evaluate((art) => {
    const content = art.querySelector('.art-content')?.getBoundingClientRect()
    const frame = art.getBoundingClientRect()
    const footer = art.querySelector('.art-footer')?.getBoundingClientRect()
    if (!content || !footer) throw new Error('Missing artwork content')
    return [
      ...art.querySelectorAll(
        '.art-content b, .art-content strong, .art-content small, .art-content img',
      ),
    ]
      .filter((node) => {
        const rect = node.getBoundingClientRect()
        const bounds =
          node instanceof HTMLImageElement
            ? { top: content.top, bottom: footer.top, left: frame.left, right: frame.right }
            : content
        return (
          !(node instanceof HTMLImageElement && node.closest('.art-match, .art-featured-match')) &&
          rect.width &&
          rect.height &&
          (rect.bottom > bounds.bottom + 1 ||
            rect.top < bounds.top - 1 ||
            rect.left < bounds.left - 1 ||
            rect.right > bounds.right + 1)
        )
      })
      .map((node) => node.textContent || node.className)
  })
  expect(overflow).toEqual([])
  if (await page.locator('.art-table-heading').count()) {
    const header = await page.locator('.art-table-heading').evaluate((heading) => {
      const row = heading.nextElementSibling
      if (!row) throw new Error('Missing standings row')
      const labels = [...heading.children].map((node) => node.getBoundingClientRect())
      const cells = [...row.children].map((node) => node.getBoundingClientRect())
      return {
        grid: getComputedStyle(heading).display,
        sameColumns:
          labels.length === cells.length &&
          labels.every(
            (label, index) =>
              Math.abs(label.left - cells[index].left) < 1 &&
              Math.abs(label.width - cells[index].width) < 1,
          ),
        separateLabels: labels.every(
          (label, index) => index === 0 || label.left >= labels[index - 1].right,
        ),
      }
    })
    expect(header).toEqual({ grid: 'grid', sameColumns: true, separateLabels: true })
  }
  const featured = page.locator('.art-featured-match')
  if (await featured.count()) {
    await expect(page.locator('.art-match')).toHaveCount(0)
    await expect(page.locator('.art-featured-dash')).toHaveText('–')
    const composition = await featured.evaluate((section) => {
      const frame = section.closest('.league-art')?.getBoundingClientRect()
      const dash = section.querySelector('.art-featured-dash')?.getBoundingClientRect()
      const scores = [...section.querySelectorAll('.art-featured-team strong')].map((node) =>
        node.getBoundingClientRect(),
      )
      if (!frame || !dash || scores.length !== 2) throw new Error('Missing featured scoreboard')
      const logos = [...section.querySelectorAll('.art-featured-emblem')].map((node, side) => {
        const rect = node.getBoundingClientRect()
        return Math.abs(rect.left + rect.width / 2 - (side === 0 ? frame.left : frame.right)) < 1
      })
      return {
        noBox:
          getComputedStyle(section).borderTopWidth === '0px' &&
          getComputedStyle(section).backgroundColor === 'rgba(0, 0, 0, 0)',
        fullFrameEdges: logos.length === 2 && logos.every(Boolean),
        centralDash: Math.abs(dash.left + dash.width / 2 - frame.left - frame.width / 2) < 1,
        scoreOrder: scores[0].right <= dash.left && dash.right <= scores[1].left,
        alignedScores: Math.abs(scores[0].top - scores[1].top) < 1,
      }
    })
    expect(composition).toEqual({
      noBox: true,
      fullFrameEdges: true,
      centralDash: true,
      scoreOrder: true,
      alignedScores: true,
    })
  }
  for (const score of await page
    .locator('.art-match-team > strong, .art-featured-team > strong')
    .all())
    await expect(score).toHaveCSS('color', 'rgb(255, 255, 255)')
  const matchLayouts = await page.locator('.art-match').evaluateAll((cards) =>
    cards.map((card) => {
      const box = card.getBoundingClientRect()
      const center = box.left + box.width / 2
      const teams = [...card.querySelectorAll('.art-match-team')]
      const scores = teams.map((team) => team.querySelector('strong')?.getBoundingClientRect())
      const logos = teams.map((team, side) => {
        const emblem = team.querySelector('.art-emblem, .art-monogram')?.getBoundingClientRect()
        if (!emblem) throw new Error('Missing matchup emblem')
        return (
          Math.abs(
            emblem.left +
              emblem.width / 2 -
              (side === 0
                ? box.left + box.width / card.clientWidth
                : box.right - box.width / card.clientWidth),
          ) < 2
        )
      })
      if (!scores[0] || !scores[1]) throw new Error('Missing matchup scores')
      return {
        compact: card.clientHeight <= 160,
        clipped: getComputedStyle(card).overflow === 'hidden',
        outerLogos: logos.every(Boolean),
        centralScores: Math.abs((scores[0].right + scores[1].left) / 2 - center) < 1,
        alignedScores: Math.abs(scores[0].top - scores[1].top) < 1,
      }
    }),
  )
  for (const layout of matchLayouts)
    expect(layout).toEqual({
      compact: true,
      clipped: true,
      outerLogos: true,
      centralScores: true,
      alignedScores: true,
    })
  const pending = page.waitForEvent('download')
  await button.click()
  const download = await pending
  expect(download.suggestedFilename()).toContain(name)
  const path = test.info().outputPath(download.suggestedFilename())
  await download.saveAs(path)
  const png = await readFile(path)
  expect(png.subarray(1, 4).toString()).toBe('PNG')
  expect(png.readUInt32BE(16)).toBe(1080)
  expect(png.readUInt32BE(20)).toBe(height)
  expect(png.length).toBeGreaterThan(25000)
}

test('all four image categories export square and story with branding and focus restoration', async ({
  page,
}) => {
  const { errors, unexpectedRequests } = await mockApp(page)
  await page.goto('/league?leagueId=1')
  for (const category of ['standings', 'club', 'matchups', 'matchup']) {
    if (category === 'matchups')
      await page.getByRole('tab', { name: 'Matchups', exact: true }).click()
    const trigger =
      category === 'standings'
        ? page.getByRole('button', { name: 'Create standings image' })
        : category === 'club'
          ? page.getByRole('button', { name: /^Create club image/ }).first()
          : category === 'matchups'
            ? page.getByRole('button', { name: 'Create gameweek matchups image' })
            : page.getByRole('button', { name: /^Create matchup image/ }).first()
    await trigger.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('.art-footer')).toContainText('fantasybroadcast.net')
    await downloadImage(page, 1080, `${category}-gw24-square`)
    await page.getByRole('button', { name: 'Story · 9:16', exact: true }).click()
    await downloadImage(page, 1920, `${category}-gw24-story`)
    await dialog.screenshot({ path: test.info().outputPath(`${category}-story-preview.png`) })
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
  }
  expect(errors).toEqual([])
  expect(unexpectedRequests).toEqual([])
})

test('dense artwork shows twelve standings rows and paginates matchups with frozen data and emblems', async ({
  page,
}) => {
  await mockApp(page)
  const state = structuredClone(welcomeLeagueDiscovery)
  state.gameweek = 24
  const entries = Array.from({ length: 24 }, (_, index) => ({
    ...state.details.league_entries[0],
    id: index + 101,
    entry_id: index + 1001,
    entry_name: `Club ${index + 1} with a long football name`,
    player_first_name: `Manager ${index + 1}`,
    player_last_name: 'Long family name',
  }))
  state.details.league_entries = entries
  state.details.standings = entries.map((entry, index) => ({
    league_entry: entry.id,
    rank: index + 1,
    last_rank: index === 0 ? 1 : index + 2,
    total: 30 - index,
    points_for: 1000 - index,
  }))
  state.details.matches = Array.from({ length: 12 }, (_, index) => ({
    id: index,
    event: 24,
    league_entry_1: entries[index * 2].id,
    league_entry_2: entries[index * 2 + 1].id,
    league_entry_1_points: 50 + index,
    league_entry_2_points: 30,
    finished: true,
  }))
  await page.route('**/draft-overview', (route) => route.fulfill({ json: state }))
  await page.route('**/teams/emblems', (route) =>
    route.fulfill({
      json: entries.map((entry) => ({
        entryId: entry.entry_id,
        managerId: String(entry.id),
        name: entry.entry_name,
        url: `/api/customer/leagues/1/teams/${entry.entry_id}/emblem/test.png`,
      })),
    }),
  )
  await page.route('**/emblem/test.png', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#20e6ff"/><circle cx="32" cy="32" r="20" fill="#ff6b85"/></svg>',
    }),
  )
  await page.goto('/league?leagueId=1')
  await page.getByRole('button', { name: 'Create standings image' }).click()
  await expect(page.locator('.art-standing')).toHaveCount(12)
  await expect(page.locator('.art-standing .art-movement').first()).toBeEmpty()
  await expect(page.locator('.art-heading')).toContainText('THE TOP 12')
  await downloadImage(page, 1080, 'standings')
  await expect(page.locator('.league-art img')).toHaveCount(12)
  const standingsLayout = await page
    .locator('.art-standing')
    .first()
    .evaluate((row) => {
      const image = row.querySelector<HTMLImageElement>('img')
      const slot = row.querySelector('.art-emblem-slot')
      const name = row.querySelector('.art-identity b')
      if (!image || !slot || !name) throw new Error('Missing standings identity')
      const before = {
        height: row.getBoundingClientRect().height,
        nameLeft: name.getBoundingClientRect().left,
      }
      const enlarged =
        image.getBoundingClientRect().width > slot.getBoundingClientRect().width * 1.3
      image.style.visibility = 'hidden'
      const unchanged =
        before.height === row.getBoundingClientRect().height &&
        before.nameLeft === name.getBoundingClientRect().left
      image.style.visibility = ''
      return { enlarged, unchanged }
    })
  expect(standingsLayout).toEqual({ enlarged: true, unchanged: true })
  const headings = page.locator('.art-numeric-heading')
  await expect(headings).toHaveText(['Fantasypts', 'Leaguepts'])

  state.details.league_entries[0].entry_name = 'Changed after opening'
  await expect(page.locator('.league-art')).not.toContainText('Changed after opening')
  await page.getByRole('button', { name: 'Story · 9:16' }).click()
  await downloadImage(page, 1920, 'standings')
  await page.keyboard.press('Escape')
  await page
    .getByRole('button', { name: /^Create club image/ })
    .first()
    .click()
  await page.getByRole('button', { name: 'Story · 9:16' }).click()
  await downloadImage(page, 1920, 'club')
  await expect(page.locator('.art-club > .art-emblem')).toHaveCSS('width', '400px')
  await page.keyboard.press('Escape')
  await page.getByRole('tab', { name: 'Matchups', exact: true }).click()
  await page.getByRole('button', { name: 'Create gameweek matchups image' }).click()
  await expect(page.locator('.art-match')).toHaveCount(10)
  await downloadImage(page, 1080, 'matchups')
  await page.getByRole('button', { name: 'Story · 9:16' }).click()
  await downloadImage(page, 1920, 'matchups')
  await page.getByLabel('Image page').selectOption('1')
  await expect(page.locator('.art-match')).toHaveCount(2)
  await downloadImage(page, 1920, 'story-2')
  const fixtures = state.details.matches
  for (const count of [4, 5]) {
    await page.getByRole('button', { name: 'Close image preview' }).click()
    state.details.matches = fixtures.slice(0, count)
    await page.reload()
    await page.getByRole('button', { name: 'Create gameweek matchups image' }).click()
    await expect(page.locator('.art-match')).toHaveCount(count)
    await downloadImage(page, 1080, 'matchups')
  }
  await page.getByRole('button', { name: 'Close image preview' }).click()
  await page
    .getByRole('button', { name: /^Create matchup image/ })
    .first()
    .click()
  await downloadImage(page, 1080, 'matchup')
  await expect(page.locator('.art-featured-emblem img')).toHaveCount(2)
  await page.getByRole('button', { name: 'Story · 9:16' }).click()
  await downloadImage(page, 1920, 'matchup')
})

test('export failure can be retried and native share cancellation preserves the download', async ({
  page,
}) => {
  await mockApp(page)
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.toBlob
    let failures = 2
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      if (failures-- > 0) {
        callback(null)
        return
      }
      original.call(this, callback, type, quality)
    }
    Object.defineProperty(navigator, 'canShare', { value: () => true })
    Object.defineProperty(navigator, 'share', {
      value: async ({ files }: ShareData) => {
        if (!files?.length || files[0].type !== 'image/png') throw new Error('No PNG')
        document.documentElement.dataset.sharedFile = files[0].name
        throw new DOMException('Cancelled', 'AbortError')
      },
    })
  })
  await page.goto('/league?leagueId=1')
  await page.getByRole('button', { name: 'Create standings image' }).click()
  await expect(page.getByRole('alert')).toContainText('Could not create the PNG')
  await page.getByRole('button', { name: 'Retry image' }).click()
  await expect(page.getByRole('button', { name: 'Share', exact: true })).toBeEnabled({
    timeout: 20000,
  })
  await page.getByRole('button', { name: 'Share', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute(
    'data-shared-file',
    /standings-gw24-square.png/,
  )
  await expect(page.getByRole('alert')).toHaveCount(0)
  await downloadImage(page, 1080, 'standings')
})

test('broken emblems degrade gracefully and upcoming matchup images keep scores unavailable', async ({
  page,
}) => {
  await mockApp(page)
  const state = structuredClone(welcomeLeagueDiscovery)
  state.gameweek = 24
  state.details.matches = state.details.matches.map((match) => ({ ...match, event: 25 }))
  await page.route('**/draft-overview', (route) => route.fulfill({ json: state }))
  await page.route('**/teams/emblems', (route) =>
    route.fulfill({
      json: state.details.league_entries.map((entry) => ({
        entryId: entry.entry_id,
        managerId: String(entry.id),
        name: entry.entry_name,
        url: '/broken-emblem.png',
      })),
    }),
  )
  await page.route('**/broken-emblem.png', (route) => route.fulfill({ status: 404 }))
  await page.goto('/league?leagueId=1&view=matchups')
  await page
    .getByRole('button', { name: /^Create matchup image/ })
    .first()
    .click()
  await downloadImage(page, 1080, 'matchup-gw25')
  await expect(page.locator('.art-result-status')).toContainText('Upcoming')
  await expect(page.locator('.art-featured-team > strong')).toHaveText(['—', '—'])
  await expect(page.locator('.league-art img')).toHaveCount(0)
})

test('live updates do not alter an open image and reopening captures the latest score', async ({
  page,
}) => {
  await mockApp(page)
  await page.clock.install()
  const entries = welcomeLeagueDiscovery.details.league_entries
  let total = 42
  let requests = 0
  await page.route('**/api/customer/leagues/1/live', (route) => {
    requests++
    return route.fulfill({
      json: {
        source: 'DRAFT',
        gameweek: 24,
        status: 'LIVE',
        baselineGameweek: 23,
        pointsFetchedAt: new Date().toISOString(),
        fixturesFetchedAt: new Date().toISOString(),
        managerScores: {},
        matchups: [],
        scoresUnavailableReason: null,
        standingsUnavailableReason: null,
        standings: entries.map((entry, index) => ({
          teamId: String(entry.id),
          teamName: entry.entry_name,
          managerName: entry.player_first_name,
          position: index + 1,
          total: index === 0 ? total : 30,
          pointsFor: 1000,
          gameweekPoints: 50,
        })),
      },
    })
  })
  await page.goto('/league?leagueId=1&standings=live')
  await expect(page.locator('.league-live-status')).toContainText('Live gameweek scores')
  await page.getByRole('button', { name: 'Create standings image' }).click()
  await downloadImage(page, 1080, 'standings')
  await expect(page.locator('.art-points').first()).toHaveText('42')
  total = 99
  const before = requests
  await page.clock.fastForward(11000)
  await expect.poll(() => requests).toBeGreaterThan(before)
  await expect(page.locator('.art-points').first()).toHaveText('42')
  await page.getByRole('button', { name: 'Close image preview' }).click()
  await page.getByRole('button', { name: 'Create standings image' }).click()
  await expect(page.locator('.art-points').first()).toHaveText('99')
  await downloadImage(page, 1080, 'standings')
})

test('total-points standings keep all four headers aligned with their columns', async ({
  page,
}) => {
  await mockApp(page)
  await page.route('**/api/customer/leagues', (route) =>
    route.fulfill({ json: leagues.map((league) => ({ ...league, scoringType: 'TOTAL_POINTS' })) }),
  )
  await page.goto('/league?leagueId=1')
  await page.getByRole('button', { name: 'Create standings image' }).click()
  await expect(page.locator('.art-table-heading > span')).toHaveText([
    '#',
    'Club / Manager',
    'Move',
    'Totalpts',
  ])
  await downloadImage(page, 1080, 'standings')
  await page.getByRole('button', { name: 'Story · 9:16' }).click()
  await downloadImage(page, 1920, 'standings')
})
