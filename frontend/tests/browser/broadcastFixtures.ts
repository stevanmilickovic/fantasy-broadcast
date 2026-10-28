import type { Page } from '@playwright/test'
import { welcomeBroadcastState, welcomeShirtCodes } from '../../src/features/public/welcomeDemoData'
import type { LiveStateResponse } from '../../src/features/broadcast/types'
import { leagues, viewer } from './fixtures'

export function broadcastFixture(totalPoints = false, frame = 0): LiveStateResponse {
  const state = welcomeBroadcastState(frame)
  for (const team of state.teams) {
    for (const [index, player] of [...team.activePlayers, ...team.benchPlayers].entries()) {
      const oldId = player.id
      player.id = String(index + 1)
      for (const event of state.events)
        if (event.managerId === team.managerId && event.playerId === oldId)
          event.playerId = player.id
    }
  }
  state.status.mode = totalPoints ? 'REAL_CLASSIC_POINTS' : 'REAL'
  if (totalPoints) {
    state.matchups = []
    state.standings = state.teams.map((team, index) => ({
      teamId: team.managerId,
      teamName: team.clubName,
      managerName: team.displayName,
      position: index + 1,
      gameweekPoints: team.score,
      total: 900 - index * 50 + team.score,
      pointsFor: 900 - index * 50 + team.score,
    }))
  }
  return state
}

export async function mockBroadcast(
  page: Page,
  totalPoints = false,
  customize?: (state: LiveStateResponse) => void,
) {
  const state = broadcastFixture(totalPoints)
  customize?.(state)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    Object.defineProperty(window, 'EventSource', {
      value: class extends EventTarget {
        receive = (event: Event) => {
          if (event instanceof CustomEvent)
            this.dispatchEvent(
              new MessageEvent('live-state', { data: JSON.stringify(event.detail) }),
            )
        }
        constructor() {
          super()
          window.addEventListener('broadcast-test-update', this.receive)
          document.documentElement.dataset.broadcastStream = 'open'
        }
        close() {
          window.removeEventListener('broadcast-test-update', this.receive)
          document.documentElement.dataset.broadcastStream = 'closed'
        }
      },
    })
  })
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/auth/me') return route.fulfill({ json: viewer })
    if (path === '/api/customer/leagues') return route.fulfill({ json: leagues })
    if (path === '/api/live-state') return route.fulfill({ json: state })
    if (/\/players\/\d+$/.test(path))
      return route.fulfill({
        json: {
          id: 1,
          name: 'Player details in this league',
          shortName: 'Player',
          club: 'Arsenal',
          position: 'MID',
          photoCode: 0,
          gameweek: 24,
          points: 5,
          changes: [],
          history: [],
        },
      })
    if (path === '/api/customer/fpl/shirts') return route.fulfill({ json: welcomeShirtCodes })
    return route.fulfill({ status: 404, json: { detail: 'Unexpected test request: ' + path } })
  })
  await page.route('https://fantasy.premierleague.com/**', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 100"><path fill="#eee" d="M20 5 0 25l15 15 5-5v60h40V35l5 5 15-15L60 5 50 15H30Z"/></svg>',
    }),
  )
  return { state, errors }
}
