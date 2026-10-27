import { request } from '../../shared/api/http'
import type {
  AdminLeague,
  AdminLeaguePage,
  AdminUser,
  AdminUserPage,
  BroadcastSchedule,
} from './types'
export const loadAdminLeagues = async (
  page = 0,
  size = 10,
  search = '',
  signal?: AbortSignal,
): Promise<AdminLeaguePage> =>
  (
    await request(
      `/api/customer/admin/leagues?${new URLSearchParams({ page: String(page), size: String(size), search })}`,
      { signal },
    )
  ).json()

export const updateAdminLeague = async (
  league: AdminLeague,
  signal?: AbortSignal,
): Promise<AdminLeague> =>
  (
    await request(`/api/customer/admin/leagues/${league.id}`, {
      signal,
      method: 'PATCH',
      body: JSON.stringify({
        serviceEnabled: league.serviceEnabled,
        aiNarrationEnabled: league.aiNarrationEnabled,
        voiceNarrationEnabled: league.voiceNarrationEnabled,
      }),
    })
  ).json()

export const loadAdminUsers = async (
  page = 0,
  size = 10,
  search = '',
  signal?: AbortSignal,
): Promise<AdminUserPage> =>
  (
    await request(
      `/api/customer/admin/users?${new URLSearchParams({ page: String(page), size: String(size), search })}`,
      { signal },
    )
  ).json()

export const promoteAdminUser = async (userId: number, signal?: AbortSignal): Promise<AdminUser> =>
  (await request(`/api/customer/admin/users/${userId}/admin`, { signal, method: 'PATCH' })).json()

export const deleteAdminUser = async (userId: number, signal?: AbortSignal) => {
  await request(`/api/customer/admin/users/${userId}`, { signal, method: 'DELETE' })
}

export const loadBroadcastSchedules = async (signal?: AbortSignal): Promise<BroadcastSchedule[]> =>
  (await request('/api/customer/admin/broadcast-schedules', { signal })).json()

export const saveBroadcastSchedule = async (
  startsAt: string,
  endsAt: string,
  id?: number,
  signal?: AbortSignal,
): Promise<BroadcastSchedule> =>
  (
    await request(
      id
        ? `/api/customer/admin/broadcast-schedules/${id}`
        : '/api/customer/admin/broadcast-schedules',
      {
        signal,
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify({
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
        }),
      },
    )
  ).json()

export const generateTodayBroadcastSchedules = async (
  signal?: AbortSignal,
): Promise<BroadcastSchedule[]> =>
  (
    await request('/api/customer/admin/broadcast-schedules/generate-today', {
      signal,
      method: 'POST',
    })
  ).json()

export const deleteBroadcastSchedule = async (scheduleId: number, signal?: AbortSignal) => {
  await request(`/api/customer/admin/broadcast-schedules/${scheduleId}`, {
    signal,
    method: 'DELETE',
  })
}
