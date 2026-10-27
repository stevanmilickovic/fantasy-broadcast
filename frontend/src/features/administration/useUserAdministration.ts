import { useCallback, useState } from 'react'
import { useMutation } from '../../shared/api/useMutation'
import { useQuery } from '../../shared/api/useQuery'
import { deleteAdminUser, loadAdminUsers, promoteAdminUser } from './api'
import type { AdminUser } from './types'

export function useUserAdministration() {
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [notice, setMessage] = useState<string | null>(null)
  const mutation = useMutation()
  const busy = mutation.busy
  const message = mutation.error ?? notice

  const load = useCallback(
    (signal: AbortSignal) => loadAdminUsers(page, pageSize, search, signal),
    [page, pageSize, search],
  )
  const query = useQuery(page + ':' + pageSize + ':' + search, load)
  const users = query.data?.items ?? []
  const totalItems = query.data?.totalItems ?? 0
  const refresh = (requestedPage = page) => {
    setPage(requestedPage)
    query.refresh()
  }
  const promote = async (user: AdminUser) => {
    const result = await mutation.run((signal) => promoteAdminUser(user.id, signal))
    if (!result) return

    await refresh()
    setMessage(`${user.email} is now an administrator.`)
  }

  const remove = async (user: AdminUser) => {
    if (!window.confirm(`Delete ${user.email} and any leagues they created?`)) return
    const result = await mutation.run((signal) => deleteAdminUser(user.id, signal))
    if (!result) return

    const nextPage = users.length === 1 && page > 0 ? page - 1 : page
    await refresh(nextPage)
    setMessage(`${user.email} was deleted.`)
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const successMessage = message?.includes('administrator') || message?.includes('deleted')

  return {
    page,
    setPage,
    pageSize,
    setPageSize,
    searchInput,
    setSearchInput,
    search,
    setSearch,
    message,
    busy,
    query,
    users,
    totalItems,
    promote,
    remove,
    totalPages,
    successMessage,
  }
}
