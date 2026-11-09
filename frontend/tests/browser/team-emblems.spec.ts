import { expect, test, type Page } from '@playwright/test'
import { mockApp } from './fixtures'
import { mockBroadcast } from './broadcastFixtures'
import { welcomeLeagueDiscovery } from '../../src/features/public/welcomeDemoData'
import type { TeamEmblemData } from '../../src/features/leagues/teamEmblems'

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1kAAAAASUVORK5CYII=',
  'base64',
)
const imageUrl = (id: number, version = 1) =>
  `/api/customer/leagues/1/teams/${id}/emblem/test-${version}.png`
const teams = (): TeamEmblemData[] =>
  welcomeLeagueDiscovery.details.league_entries.map((entry) => ({
    entryId: entry.entry_id,
    managerId: String(entry.id),
    name: entry.entry_name,
    url: imageUrl(entry.entry_id),
  }))

async function images(page: Page) {
  await page.route('**/emblem/*.png', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="#20e6ff" d="M8 4h48v34L32 60 8 38Z"/><path fill="#25002c" d="m32 12 6 12 14 2-10 10 2 14-12-6-12 6 2-14-10-10 14-2Z"/></svg>',
    }),
  )
}

async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  )
}

test('owner uploads, replaces and removes PNG emblems with mobile-friendly controls', async ({
  page,
}) => {
  await mockApp(page)
  await images(page)
  const data = teams()
  data[0].url = null
  let uploads = 0
  await page.route('**/teams/emblems', (route) => route.fulfill({ json: data }))
  await page.route(`**/teams/${data[0].entryId}/emblem`, async (route) => {
    if (route.request().method() === 'PUT') {
      expect(route.request().headers()['content-type']).toContain('multipart/form-data; boundary=')
      expect(route.request().postDataBuffer()?.includes(Buffer.from('filename="crest.png"'))).toBe(
        true,
      )
      data[0].url = imageUrl(data[0].entryId, ++uploads)
    } else if (route.request().method() === 'DELETE') data[0].url = null
    else throw new Error('Unexpected emblem mutation')
    await route.fulfill({ status: 204 })
  })
  await page.goto('/league/manage?leagueId=1')
  const field = page.getByLabel(`Upload PNG for ${data[0].name}`, { exact: true })
  await field.setInputFiles({ name: 'photo.jpg', mimeType: 'image/jpeg', buffer: png })
  await expect(page.getByRole('alert')).toContainText('Choose a PNG')
  expect(uploads).toBe(0)
  await field.setInputFiles({
    name: 'crest.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(5_000_001),
  })
  await expect(page.getByRole('alert')).toContainText('no larger than 5 MB')
  await field.setInputFiles({ name: 'crest.png', mimeType: 'image/png', buffer: png })
  const row = page.locator('.league-emblem-list li').filter({ hasText: data[0].name })
  await expect(row.locator('img')).toHaveAttribute('src', imageUrl(data[0].entryId, 1))
  await field.setInputFiles({ name: 'crest.png', mimeType: 'image/png', buffer: png })
  await expect(row.locator('img')).toHaveAttribute('src', imageUrl(data[0].entryId, 2))
  await fits(page)
  await page.screenshot({ path: test.info().outputPath('emblem-management.png'), fullPage: true })
  await row.getByRole('button', { name: `Remove emblem for ${data[0].name}` }).click()
  await expect(row.locator('img')).toHaveCount(0)
  await expect(
    page.getByRole('status', { name: '' }).filter({ hasText: 'Team emblem saved.' }),
  ).toBeVisible()
})

test('team emblems appear throughout the league tabs and degrade gracefully if an image fails', async ({
  page,
}) => {
  await mockApp(page)
  await images(page)
  const data = teams()
  await page.route('**/teams/emblems', (route) => route.fulfill({ json: data }))
  await page.goto('/league?leagueId=1')
  for (const tab of ['Standings', 'Teams', 'Matchups', 'Insights']) {
    await page.getByRole('tab', { name: tab, exact: true }).click()
    await expect(page.getByRole('tabpanel').locator('.team-emblem:visible').first()).toBeVisible()
    await fits(page)
  }
  await page.screenshot({ path: test.info().outputPath('emblem-insights.png'), fullPage: true })
  await page.route('**/emblem/*.png', (route) => route.fulfill({ status: 404 }))
  data[0].url = imageUrl(data[0].entryId, 999)
  await page.reload()
  await expect(
    page.getByRole('tabpanel').getByRole('link', { name: data[0].name }).first(),
  ).toBeVisible()
  await expect(page.locator(`img[src="${data[0].url}"]`)).toHaveCount(0)
})

test('matchup emblems sit at the outer edges and center against the full club box', async ({
  page,
}) => {
  await mockApp(page)
  await images(page)
  const data = teams()
  await page.route('**/teams/emblems', (route) => route.fulfill({ json: data }))
  await page.goto('/league?leagueId=1&view=matchups')
  const card = page.locator('.league-matchup-card').first()
  await expect(card.locator('.league-matchup-club .team-emblem')).toHaveCount(2)
  for (const side of ['first-club', 'second-club']) {
    const layout = await card.locator(`.${side}`).evaluate((club) => {
      const image = club.querySelector('.team-emblem')?.getBoundingClientRect()
      if (!image) throw new Error('Missing matchup emblem')
      const box = club.getBoundingClientRect()
      const identity = club.querySelector(':scope > div')?.getBoundingClientRect()
      const score = club.querySelector(':scope > strong')?.getBoundingClientRect()
      if (!identity || !score) throw new Error('Missing matchup identity or score')
      const card = club.closest('.league-matchup-card')?.getBoundingClientRect()
      if (!card) throw new Error('Missing matchup card')
      const cropped = matchMedia(
        '(max-width: 600px), (max-width: 900px) and (max-height: 480px)',
      ).matches
      const first = club.classList.contains('first-club')
      return {
        cropped,
        width: image.width,
        centered: Math.abs(image.top + image.height / 2 - box.top - box.height / 2),
        scoreCentered: Math.abs(score.top + score.height / 2 - identity.top - identity.height / 2),
        edge: cropped
          ? Math.abs(image.left + image.width / 2 - (first ? card.left + 1 : card.right - 1))
          : first
            ? Math.abs(image.left - box.left)
            : Math.abs(image.right - box.right),
      }
    })
    expect(layout.width).toBeGreaterThanOrEqual(layout.cropped ? 120 : 44)
    expect(layout.centered).toBeLessThan(1)
    expect(layout.scoreCentered).toBeLessThan(1)
    expect(layout.edge).toBeLessThan(1)
  }
  await expect(card.locator('a .team-emblem')).toHaveCount(2)
  await fits(page)
  await page.screenshot({ path: test.info().outputPath('emblem-matchups.png'), fullPage: true })
  const sizeWithEmblems = await card.boundingBox()
  const urls = data.map((team) => team.url)
  data.forEach((team) => {
    team.url = null
  })
  await page.reload()
  await expect(card.locator('.team-emblem')).toHaveCount(0)
  if (['phone', 'phone-landscape'].includes(test.info().project.name)) {
    expect((await card.boundingBox())?.height).toBe(sizeWithEmblems?.height)
  }
  data.forEach((team, index) => {
    team.url = urls[index]
  })
  data[0].url = null
  await page.reload()
  await expect(card.locator('.first-club .team-emblem')).toHaveCount(0)
  await expect(card.locator('.second-club .team-emblem')).toHaveCount(1)
  await fits(page)
  if (test.info().project.name === 'phone') {
    await page.setViewportSize({ width: 320, height: 640 })
    await fits(page)
    const clipping = await card.evaluate((element) => {
      const box = element.getBoundingClientRect()
      return {
        overflow: getComputedStyle(element).overflow,
        textFits: [...element.querySelectorAll('a > span, small, strong')].every((node) => {
          const text = node.getBoundingClientRect()
          return text.left >= box.left && text.right <= box.right
        }),
      }
    })
    expect(clipping).toEqual({ overflow: 'hidden', textFits: true })
  }
})

for (const points of [false, true]) {
  test(`${points ? 'total-points' : 'H2H'} broadcast carries emblems through reveals and live standings`, async ({
    page,
  }) => {
    const { state, errors } = await mockBroadcast(page, points)
    await images(page)
    const data = state.teams.map((team, index) => ({
      entryId: index + 9000,
      managerId: team.managerId,
      name: team.clubName,
      url: imageUrl(index + 9000),
    }))
    await page.route('**/teams/emblems', (route) => route.fulfill({ json: data }))
    await page.goto('/broadcast?leagueId=1')
    const identity = page.locator('.broadcast-identity h2[data-reveal-role]')
    const scene = page.locator('.broadcast-scene')
    const emblems = page.locator('.broadcast-identity > .team-emblem')
    await expect(scene).toHaveAttribute('data-motion', 'introducing')
    await expect(emblems).toHaveCount(points ? 1 : 2)
    expect(await identity.first().evaluate((node) => node.getAnimations().length)).toBeGreaterThan(
      0,
    )
    const introduction = await scene.evaluate((root) => {
      const bounds = (role: string) =>
        root.querySelector<HTMLElement>(`[data-reveal-role="${role}"]`)?.getBoundingClientRect()
      const home = bounds('home'),
        away = bounds('away')
      const first = bounds('home-emblem'),
        second = bounds('away-emblem')
      const image = root.querySelector<HTMLElement>('[data-reveal-role="home-emblem"]')
      const frame = root.getBoundingClientRect()
      if (!home || !first || !image) throw new Error('Missing club introduction')
      const centerX = (rect: DOMRect) => rect.left + rect.width / 2
      const centerY = (rect: DOMRect) => rect.top + rect.height / 2
      const stacked = first.bottom <= home.top + 1
      return {
        stacked,
        larger:
          first.width >
          image.offsetWidth * (getComputedStyle(image).position === 'absolute' ? 1 : 1.5),
        homeOutside: stacked
          ? Math.abs(centerX(first) - centerX(frame)) < 1
          : centerX(first) < centerX(home),
        awayOutside:
          !second ||
          !away ||
          (stacked
            ? second.top >= away.bottom - 1 && Math.abs(centerX(second) - centerX(frame)) < 1
            : centerX(second) > centerX(away)),
        centered: stacked || Math.abs(centerY(first) - centerY(home)) < 1,
        inside: [first, second]
          .filter((rect): rect is DOMRect => !!rect)
          .every(
            (rect) =>
              rect.left >= frame.left - 1 &&
              rect.right <= frame.right + 1 &&
              rect.top >= frame.top - 1 &&
              rect.bottom <= frame.bottom + 1,
          ),
      }
    })
    expect(introduction).toMatchObject({
      larger: true,
      homeOutside: true,
      awayOutside: true,
      centered: true,
      inside: true,
    })
    expect(introduction.stacked).toBe(['phone', 'tablet'].includes(test.info().project.name))
    await expect(scene).toHaveAttribute('data-motion', 'landing')
    const flights = await scene.evaluateHandle((root) => {
      const effects = [...root.querySelectorAll<HTMLElement>('[data-reveal-role]')].flatMap(
        (node) => node.getAnimations(),
      )
      const cover =
        root
          .closest('.broadcast-view')
          ?.querySelector('.broadcast-intro-backdrop')
          ?.getAnimations() ?? []
      for (const effect of [...effects, ...cover]) {
        effect.pause()
        effect.currentTime = 0
      }
      return [...effects, ...cover]
    })
    await page.screenshot({
      path: test.info().outputPath('emblem-introduction.png'),
      fullPage: true,
    })
    const edgeClipping = await flights.evaluate((effects) => {
      const images = [
        ...document.querySelectorAll<HTMLElement>('.broadcast-identity > .team-emblem'),
      ].filter((image) => getComputedStyle(image).position === 'absolute')
      let checked = 0
      let escaped = false
      for (const fraction of [0.5, 0.9, 0.99, 1]) {
        for (const effect of effects) {
          const duration = Number(effect.effect?.getTiming().duration)
          effect.currentTime = duration * fraction
        }
        for (const image of images) {
          const club = image.parentElement
          if (!club) throw new Error('Missing club identity')
          const bounds = club.getBoundingClientRect()
          const logo = image.getBoundingClientRect()
          const x = club.classList.contains('away') ? bounds.right + 1 : bounds.left - 1
          const y = logo.top + logo.height / 2
          if (x <= logo.left || x >= logo.right) continue
          checked++
          image.style.pointerEvents = 'auto'
          escaped ||= document.elementFromPoint(x, y) === image
          image.style.removeProperty('pointer-events')
        }
      }
      return { cropped: images.length > 0, checked, escaped }
    })
    if (edgeClipping.cropped) {
      expect(edgeClipping.checked).toBeGreaterThan(0)
      expect(edgeClipping.escaped).toBe(false)
    }
    await flights.evaluate((effects) => effects.forEach((effect) => effect.finish()))
    await flights.dispose()
    await expect(scene).toHaveAttribute('data-phase', 'idle')
    await expect(emblems.first()).toBeVisible()
    for (const emblem of await emblems.all()) {
      const position = await emblem.evaluate((node) => {
        if (!node.parentElement) throw new Error('Missing club identity')
        const image = node.getBoundingClientRect(),
          club = node.parentElement.getBoundingClientRect()
        const cropped = getComputedStyle(node).position === 'absolute'
        const away = node.parentElement.classList.contains('away')
        return {
          centered: Math.abs(image.top + image.height / 2 - club.top - club.height / 2),
          cropped,
          width: image.width,
          edge: Math.abs(image.left + image.width / 2 - (away ? club.right : club.left)),
          clip: getComputedStyle(node.parentElement).clipPath,
        }
      })
      expect(position.centered).toBeLessThan(1)
      if (position.cropped) {
        expect(position.width).toBeGreaterThanOrEqual(96)
        expect(position.edge).toBeLessThan(1)
        expect(position.clip).toMatch(/^inset\(/)
      }
    }
    await fits(page)
    await page.screenshot({ path: test.info().outputPath('emblem-broadcast.png'), fullPage: true })
    await page.getByRole('button', { name: 'Standings', exact: true }).click()
    await expect(page.locator('.broadcast-standings tbody .team-emblem')).toHaveCount(
      state.standings.length,
    )
    await fits(page)
    expect(errors).toEqual([])
  })
}
