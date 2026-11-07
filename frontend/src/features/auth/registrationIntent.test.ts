import { beforeEach, expect, it, vi } from 'vitest'
import {
  consumeRegistrationIntent,
  registrationDestination,
  rememberRegistrationIntent,
} from './registrationIntent'

beforeEach(() => {
  sessionStorage.clear()
  vi.restoreAllMocks()
})

it('accepts only a registration intent and supported plan codes', () => {
  expect(registrationDestination('?next=register&plan=STANDARD')).toBe('/leagues/new?plan=STANDARD')
  expect(registrationDestination('?next=register&plan=unknown')).toBe('/leagues/new')
  for (const next of ['https://evil.test', '//evil.test', '/administration', 'register%0a'])
    expect(registrationDestination(`?next=${encodeURIComponent(next)}`)).toBeUndefined()
})

it('retains intent across provider failures and consumes it once after returning', () => {
  rememberRegistrationIntent('?next=register&plan=AI_BROADCASTER')
  rememberRegistrationIntent('?oauth=failed')
  expect(consumeRegistrationIntent()).toBe('/leagues/new?plan=AI_BROADCASTER')
  expect(consumeRegistrationIntent()).toBeUndefined()
  rememberRegistrationIntent('?next=register')
  rememberRegistrationIntent('')
  expect(consumeRegistrationIntent()).toBeUndefined()
})

it('rejects expired, malformed and externally targeted storage', () => {
  const now = Date.now()
  for (const value of [
    'broken',
    JSON.stringify({ destination: '//evil.test', expiresAt: now + 1000 }),
    JSON.stringify({ destination: '/leagues/new', expiresAt: now - 1 }),
  ]) {
    sessionStorage.setItem('fb:registration-intent', value)
    expect(consumeRegistrationIntent()).toBeUndefined()
    expect(sessionStorage.getItem('fb:registration-intent')).toBeNull()
  }
})

it('handles unavailable browser storage while the direct destination remains valid', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Disabled')
  })
  expect(() => rememberRegistrationIntent('?next=register')).not.toThrow()
  expect(registrationDestination('?next=register')).toBe('/leagues/new')
})
