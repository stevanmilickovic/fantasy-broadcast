import type { RegisteredLeague } from '../leagues/types'
export type AdminLeague = RegisteredLeague & {
  ownerName: string | null
  registeredUsers: string | null
  createdAt: string
}

export type AdminLeaguePage = {
  items: AdminLeague[]
  page: number
  size: number
  totalItems: number
}

export type AdminUser = {
  id: number
  displayName: string
  role: 'USER' | 'ADMIN'
  createdAt: string
  registeredLeagueCount: number
  ownedLeagueCount: number
}

export type AdminUserPage = {
  items: AdminUser[]
  page: number
  size: number
  totalItems: number
}

export type BroadcastSchedule = { id: number; startsAt: string; endsAt: string }
