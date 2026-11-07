import { describe, expect, it } from 'vitest'
import type { AuthUser } from '../features/auth/types'
import { positiveId, resolveRoute } from './routes'

const user: AuthUser = { id: 1, email: 'user@example.test', displayName: 'User', role: 'USER' }
const admin: AuthUser = { ...user, role: 'ADMIN' }

describe('route ownership', () => {
  it('preserves registration intent for guests and already signed-in users', () => {
    expect(resolveRoute('/leagues/new', '?plan=AI_BROADCASTER', null)).toEqual({
      page: 'redirect',
      to: '/register?next=register&plan=AI_BROADCASTER',
    })
    expect(resolveRoute('/register', '?next=register&plan=STANDARD', user)).toEqual({
      page: 'redirect',
      to: '/leagues/new?plan=STANDARD',
    })
    expect(resolveRoute('/register', '?next=https://example.test', user)).toEqual({
      page: 'redirect',
      to: '/leagues',
    })
  })
  it('separates discovery from registration and preserves old discovery links', () => {
    expect(resolveRoute('/leagues/find', '?search=Sunday', user)).toEqual({
      page: 'leagues',
      pathname: '/leagues/find',
    })
    expect(resolveRoute('/leagues/new', '', user)).toEqual({
      page: 'leagues',
      pathname: '/leagues/new',
    })
    expect(resolveRoute('/leagues/new', '?search=Sunday&page=2', user)).toEqual({
      page: 'redirect',
      to: '/leagues/find?search=Sunday&page=2',
    })
  })
  it('opens league management and redirects existing subscription links', () => {
    expect(resolveRoute('/league/manage', '?leagueId=42', user)).toEqual({
      page: 'leagues',
      pathname: '/league/manage',
    })
    expect(resolveRoute('/league/subscription', '?leagueId=42', user)).toEqual({
      page: 'redirect',
      to: '/league/manage?leagueId=42',
    })
    expect(resolveRoute('/league/manage', '?leagueId=42', null)).toEqual({
      page: 'redirect',
      to: '/login',
    })
  })
  it('keeps direct payment links public for every session state', () => {
    for (const viewer of [null, user, admin])
      expect(resolveRoute('/pay', '?_ptxn=txn_0123456789abcdefghijklmnop', viewer)).toEqual({
        page: 'payment-link',
      })
  })
  it('protects private pages and preserves password reset links', () => {
    expect(resolveRoute('/league', '?leagueId=42', null)).toEqual({
      page: 'redirect',
      to: '/login',
    })
    expect(resolveRoute('/reset-password', '?token=abc', admin).page).toBe('auth')
    expect(resolveRoute('/privacy', '', admin)).toEqual({ page: 'public', name: 'privacy' })
  })
  it('opens league broadcasts for both roles, and global broadcasts only for admins', () => {
    for (const viewer of [user, admin])
      expect(resolveRoute('/broadcast', '?leagueId=42', viewer)).toEqual({
        page: 'broadcast',
        leagueId: 42,
      })
    expect(resolveRoute('/broadcast', '', admin).page).toBe('broadcast')
    expect(resolveRoute('/broadcast', '', user)).toEqual({ page: 'redirect', to: '/leagues' })
  })
  it('rejects invalid ids and redirects unknown or unauthorized routes', () => {
    for (const value of ['0', '-1', '1.5', 'nope', '9007199254740992'])
      expect(positiveId(value)).toBeUndefined()
    expect(resolveRoute('/administration', '', user)).toEqual({ page: 'redirect', to: '/leagues' })
    expect(resolveRoute('/unknown', '', admin)).toEqual({ page: 'redirect', to: '/administration' })
  })
})
