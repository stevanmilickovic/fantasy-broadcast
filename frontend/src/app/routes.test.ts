import { describe, expect, it } from 'vitest'
import { positiveId, resolveRoute } from './routes'
import type { AuthUser } from '../types/customer'

const user: AuthUser = { id: 1, email: 'user@example.test', displayName: 'User', role: 'USER' }
const admin: AuthUser = { ...user, role: 'ADMIN' }

describe('route ownership', () => {
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
