import type { Page } from '@playwright/test'
import type { AuthUser } from '../../src/features/auth/types'
import type { LeagueDiscoveryState } from '../../src/shared/fpl/types'
import type { RegisteredLeague } from '../../src/features/leagues/types'
import {
  welcomeBroadcastState,
  welcomeLeagueDiscovery,
  welcomeShirtCodes,
} from '../../src/features/public/welcomeDemoData'

export const viewer: AuthUser = {
  id: 1,
  email: 'viewer@example.com',
  displayName: 'Viewer',
  role: 'USER',
}
export const leagues: RegisteredLeague[] = [1, 2].map((id) => ({
  id,
  fplLeagueId: 24024 + id,
  displayName: id === 1 ? 'Sunday League Elite' : 'Midweek League',
  leagueType: 'DRAFT',
  scoringType: 'H2H',
  serviceEnabled: true,
  aiNarrationEnabled: false,
  voiceNarrationEnabled: false,
  ownerUserId: 1,
}))

const team = welcomeBroadcastState(0).teams[0]
const players = [...team.activePlayers, ...team.benchPlayers]
const discovery: LeagueDiscoveryState = {
  ...welcomeLeagueDiscovery,
  gameweek: 24,
  players: players.map((player, index) => ({
    id: index + 1,
    webName: player.shortName ?? player.displayName,
    fullName: player.displayName,
    premierLeagueClub: player.premierLeagueClub,
    position: player.position,
  })),
  elementStatus: {
    element_status: players.map((_, index) => ({
      element: index + 1,
      owner: 1,
      status: 'o',
      in_accepted_trade: false,
    })),
  },
  entryEvents: {
    '1': {
      picks: players.map((_, index) => ({
        element: index + 1,
        position: index + 1,
        multiplier: index < 11 ? 1 : 0,
        starter: index < 11,
        benched: index >= 11,
      })),
    },
  },
}

export async function mockApp(page: Page, user: AuthUser | null = viewer) {
  let session = user
  const errors: string[] = []
  const unexpectedRequests: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const path = new URL(route.request().url()).pathname
      if (path === '/api/auth/me')
        return route.fulfill(session ? { json: session } : { status: 401, json: {} })
      if (path === '/api/live-state') return route.fulfill({ json: welcomeBroadcastState(0) })
      if (path === '/api/live-state/stream')
        return route.fulfill({ contentType: 'text/event-stream', body: ': connected\n\n' })
      if (path === '/api/auth/options')
        return route.fulfill({ json: { googleSignInEnabled: false } })
      if (path === '/api/auth/login') {
        session = viewer
        return route.fulfill({ json: { user: viewer } })
      }
      if (path === '/api/auth/logout') {
        session = null
        return route.fulfill({ status: 204 })
      }
      if (path === '/api/auth/password/forgot')
        return route.fulfill({ json: { message: 'Check your email.' } })
      if (path === '/api/customer/fpl/shirts') return route.fulfill({ json: welcomeShirtCodes })
      if (path === '/api/customer/leagues' || path === '/api/customer/leagues/search')
        return route.fulfill({ json: leagues })
      if (path === '/api/customer/league-registration')
        return route.fulfill({ json: { canRegisterLeague: true } })
      if (path.endsWith('/draft-overview')) return route.fulfill({ json: discovery })
      if (
        path === '/api/customer/broadcast-schedules/active' ||
        path === '/api/customer/admin/broadcast-schedules'
      )
        return route.fulfill({ json: [] })
      if (path === '/api/customer/league-payment/preview')
        return route.fulfill({
          json: {
            displayName: 'Sunday League Elite',
            managerCount: 4,
            registrationEligible: true,
            validationMessage: null,
            checkoutReady: true,
          },
        })
      if (path === '/api/customer/admin/leagues')
        return route.fulfill({
          json: {
            items: leagues.map((league) => ({
              ...league,
              ownerEmail: viewer.email,
              registeredUsers: viewer.email,
              createdAt: '2026-10-01T12:00:00Z',
            })),
            page: 0,
            size: 10,
            totalItems: leagues.length,
          },
        })
      if (path === '/api/customer/admin/users')
        return route.fulfill({
          json: {
            items: [
              {
                ...viewer,
                createdAt: '2026-10-01T12:00:00Z',
                registeredLeagueCount: 2,
                ownedLeagueCount: 2,
              },
            ],
            page: 0,
            size: 10,
            totalItems: 1,
          },
        })
      if (/\/players\/\d+$/.test(path))
        return route.fulfill({
          json: {
            id: 1,
            name: players[0].displayName,
            shortName: players[0].shortName,
            club: 'Arsenal',
            position: players[0].position,
            photoCode: 0,
            gameweek: 24,
            points: 0,
            changes: [],
            history: [],
          },
        })
      unexpectedRequests.push(path)
      return route.fulfill({ status: 404, json: { detail: 'Unexpected test request: ' + path } })
    },
  )
  await page.route('https://fantasy.premierleague.com/**', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 100"><path fill="#eee" d="M20 5 0 25l15 15 5-5v60h40V35l5 5 15-15L60 5 50 15H30Z"/></svg>',
    }),
  )
  return { errors, unexpectedRequests }
}
