import { useEffect, useState } from 'react'
import { deleteAdminUser, loadAdminUsers, promoteAdminUser } from './api'
import type { AdminUser } from './types'

type Props = { currentUserId: number }

export function UserAdministration({ currentUserId }: Props) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [totalItems, setTotalItems] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = async (requestedPage = page) => {
    const result = await loadAdminUsers(requestedPage, pageSize, search)
    setUsers(result.items)
    setPage(result.page)
    setTotalItems(result.totalItems)
  }

  useEffect(() => {
    void refresh(page).catch((error: Error) => setMessage(error.message))
  }, [page, pageSize, search])

  const promote = async (user: AdminUser) => {
    setBusy(true)
    try {
      await promoteAdminUser(user.id)
      await refresh()
      setMessage(`${user.email} is now an administrator.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update user.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (user: AdminUser) => {
    if (!window.confirm(`Delete ${user.email} and any leagues they created?`)) return
    setBusy(true)
    try {
      await deleteAdminUser(user.id)
      const nextPage = users.length === 1 && page > 0 ? page - 1 : page
      await refresh(nextPage)
      setMessage(`${user.email} was deleted.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to delete user.')
    } finally {
      setBusy(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const successMessage = message?.includes('administrator') || message?.includes('deleted')

  return (
    <section className="league-discovery user-administration">
      <div className="discovery-form">
        <div>
          <span className="kicker">Administration</span>
          <h2>User administration</h2>
          <p>Search accounts, promote trusted users, or remove users and their created leagues.</p>
        </div>
      </div>
      {message && (
        <p className={successMessage ? 'broadcast-schedule-success' : 'discovery-error'}>
          {message}
        </p>
      )}
      <form
        className="admin-league-search"
        onSubmit={(event) => {
          event.preventDefault()
          setPage(0)
          setSearch(searchInput.trim())
        }}
      >
        <label htmlFor="admin-user-search">Find a user</label>
        <input
          id="admin-user-search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search by email or display name"
        />
        <button type="submit" className="secondary-action">
          Search
        </button>
        {search && (
          <button
            type="button"
            className="secondary-action"
            onClick={() => {
              setSearchInput('')
              setSearch('')
              setPage(0)
            }}
          >
            Clear
          </button>
        )}
      </form>
      <div className="admin-user-table">
        {users.map((user) => (
          <div className="admin-user-row" key={user.id}>
            <span>
              <strong>{user.displayName}</strong>
              <small>{user.email}</small>
            </span>
            <span>{user.role}</span>
            <span>
              {user.registeredLeagueCount} followed · {user.ownedLeagueCount} owned
            </span>
            <small>Registered {new Date(user.createdAt).toLocaleString()}</small>
            <div>
              <button
                type="button"
                className="secondary-action"
                disabled={busy || user.role === 'ADMIN'}
                onClick={() => void promote(user)}
              >
                Make admin
              </button>
              <button
                type="button"
                className="secondary-action schedule-delete"
                disabled={busy || user.id === currentUserId}
                onClick={() => void remove(user)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
      {totalItems === 0 && <p className="empty-text">No users match this search.</p>}
      {totalItems > 0 && (
        <nav className="admin-pagination" aria-label="User administration pages">
          <label>
            Per page{' '}
            <select
              value={pageSize}
              disabled={busy}
              onChange={(event) => {
                setPageSize(Number(event.target.value))
                setPage(0)
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
          <button
            className="secondary-action"
            disabled={page === 0 || busy}
            onClick={() => setPage((current) => current - 1)}
          >
            Previous
          </button>
          <span>
            Page {page + 1} of {totalPages} · {totalItems} users
          </span>
          <button
            className="secondary-action"
            disabled={page + 1 >= totalPages || busy}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </section>
  )
}
