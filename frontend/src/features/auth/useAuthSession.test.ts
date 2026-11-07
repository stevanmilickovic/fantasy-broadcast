import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { loadCurrentUser } from './api'
import { rememberRegistrationIntent } from './registrationIntent'
import { useAuthSession } from './useAuthSession'

vi.mock('./api', () => ({ loadCurrentUser: vi.fn(), logout: vi.fn() }))
const user = { id: 1, email: 'test@example.test', displayName: 'Test', role: 'USER' as const }
beforeEach(() => {
  sessionStorage.clear()
  window.history.replaceState({}, '', '/login')
  vi.mocked(loadCurrentUser).mockResolvedValue(user)
})

it('honors explicit registration intent and keeps ordinary role-based login landings', async () => {
  const navigate = vi.fn()
  const { result } = renderHook(() => useAuthSession(navigate))
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  await act(async () => {
    await result.current.handleAuthenticated({ user }, '/leagues/new')
  })
  expect(navigate).toHaveBeenLastCalledWith('/leagues/new', true)
  await act(async () => {
    await result.current.handleAuthenticated({ user })
  })
  expect(navigate).toHaveBeenLastCalledWith('/leagues', true)
  await act(async () => {
    await result.current.handleAuthenticated({ user: { ...user, role: 'ADMIN' } })
  })
  expect(navigate).toHaveBeenLastCalledWith('/administration', true)
})

it('consumes registration intent after the provider redirects to the homepage', async () => {
  rememberRegistrationIntent('?next=register&plan=STANDARD')
  window.history.replaceState({}, '', '/')
  const navigate = vi.fn()
  const { result } = renderHook(() => useAuthSession(navigate))
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  expect(navigate).toHaveBeenCalledWith('/leagues/new?plan=STANDARD', true)
  expect(sessionStorage.getItem('fb:registration-intent')).toBeNull()
})
