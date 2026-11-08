import { request } from '../../shared/api/http'
import type { AuthOptions, AuthResponse, AuthUser, PendingRegistrationResponse } from './types'
export const loadPasswordCapability = async (
  signal?: AbortSignal,
): Promise<{ hasPassword: boolean }> =>
  (await request('/api/auth/password/capability', { signal })).json()

export const changePassword = async (
  currentPassword: string,
  password: string,
  signal?: AbortSignal,
): Promise<void> => {
  await request('/api/auth/password/change', {
    method: 'POST',
    signal,
    body: JSON.stringify({ currentPassword, password }),
  })
}
export const updateProfile = async (displayName: string, signal?: AbortSignal): Promise<AuthUser> =>
  (
    await request('/api/auth/me', {
      method: 'PATCH',
      signal,
      body: JSON.stringify({ displayName }),
    })
  ).json()
export const authenticate = async (
  email: string,
  password: string,
  signal?: AbortSignal,
): Promise<AuthResponse> =>
  (
    await request('/api/auth/login', {
      signal,
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  ).json()

export const requestRegistration = async (
  email: string,
  password: string,
  signal?: AbortSignal,
): Promise<PendingRegistrationResponse> =>
  (
    await request('/api/auth/register', {
      signal,
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  ).json()

export const verifyRegistration = async (
  email: string,
  code: string,
  signal?: AbortSignal,
): Promise<AuthResponse> =>
  (
    await request('/api/auth/register/verify', {
      signal,
      method: 'POST',
      body: JSON.stringify({ email, code }),
    })
  ).json()

export const requestPasswordReset = async (
  email: string,
  signal?: AbortSignal,
): Promise<{ message: string }> =>
  (
    await request('/api/auth/password/forgot', {
      signal,
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  ).json()

export const resetPassword = async (
  token: string,
  password: string,
  signal?: AbortSignal,
): Promise<void> => {
  await request('/api/auth/password/reset', {
    signal,
    method: 'POST',
    body: JSON.stringify({ token, password }),
  })
}

export const loadAuthOptions = async (signal?: AbortSignal): Promise<AuthOptions> =>
  (await request('/api/auth/options', { signal })).json()

export const loadCurrentUser = async (signal?: AbortSignal): Promise<AuthUser> =>
  (await request('/api/auth/me', { signal })).json()

export const logout = async (signal?: AbortSignal) => {
  await request('/api/auth/logout', { signal, method: 'POST' })
}

export const requestAccountDeletion = async (signal?: AbortSignal): Promise<{ message: string }> =>
  (await request('/api/auth/account-deletion-request', { signal, method: 'POST' })).json()
