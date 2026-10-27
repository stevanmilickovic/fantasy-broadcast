import { act, renderHook, waitFor } from '@testing-library/react'
import type { FormEvent } from 'react'
import { expect, it, vi } from 'vitest'
import { loadAuthOptions, requestRegistration, verifyRegistration } from './api'
import { useAuthForm } from './useAuthForm'

vi.mock('./api', () => ({
  loadAuthOptions: vi.fn(),
  requestRegistration: vi.fn(),
  verifyRegistration: vi.fn(),
  authenticate: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
}))

it('keeps email verification active after an invalid code and authenticates only on success', async () => {
  vi.mocked(loadAuthOptions).mockResolvedValue({ googleSignInEnabled: false })
  vi.mocked(requestRegistration).mockResolvedValue({
    email: 'test@example.test',
    message: 'Check email',
  })
  const authenticate = vi.fn()
  const { result } = renderHook(() => useAuthForm('/register', '', authenticate))
  await waitFor(() => expect(loadAuthOptions).toHaveBeenCalled())
  act(() => {
    result.current.setEmail('test@example.test')
    result.current.setPassword('long-password')
    result.current.setConfirmPassword('long-password')
  })
  const event = { preventDefault: vi.fn() } as unknown as FormEvent
  await act(() => result.current.submit(event))
  expect(result.current.verifyingRegistration).toBe(true)
  expect(result.current.password).toBe('')
  act(() => result.current.setVerificationCode('000000'))
  vi.mocked(verifyRegistration).mockRejectedValueOnce(new Error('Invalid code'))
  await act(() => result.current.submit(event))
  expect(result.current.error).toBe('Invalid code')
  expect(result.current.verifyingRegistration).toBe(true)
  expect(authenticate).not.toHaveBeenCalled()
  const auth = {
    user: { id: 1, email: 'test@example.test', displayName: 'Test', role: 'USER' as const },
  }
  vi.mocked(verifyRegistration).mockResolvedValueOnce(auth)
  await act(() => result.current.submit(event))
  expect(authenticate).toHaveBeenCalledWith(auth)
})
