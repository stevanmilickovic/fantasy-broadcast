import { request } from '../../shared/api/http'
import type { AuthOptions, AuthResponse, AuthUser, PendingRegistrationResponse } from './types'
export const authenticate = async (email: string, password: string): Promise<AuthResponse> =>
  (
    await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
  ).json()

export const requestRegistration = async (
  email: string,
  password: string,
): Promise<PendingRegistrationResponse> =>
  (
    await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  ).json()

export const verifyRegistration = async (email: string, code: string): Promise<AuthResponse> =>
  (
    await request('/api/auth/register/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    })
  ).json()

export const requestPasswordReset = async (email: string): Promise<{ message: string }> =>
  (
    await request('/api/auth/password/forgot', { method: 'POST', body: JSON.stringify({ email }) })
  ).json()

export const resetPassword = async (token: string, password: string): Promise<void> => {
  await request('/api/auth/password/reset', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  })
}

export const loadAuthOptions = async (signal?: AbortSignal): Promise<AuthOptions> =>
  (await request('/api/auth/options', { signal })).json()

export const loadCurrentUser = async (signal?: AbortSignal): Promise<AuthUser> =>
  (await request('/api/auth/me', { signal })).json()

export const logout = async () => {
  await request('/api/auth/logout', { method: 'POST' })
}

export const requestAccountDeletion = async (): Promise<{ message: string }> =>
  (await request('/api/auth/account-deletion-request', { method: 'POST' })).json()
