import { useUserAdministration } from './useUserAdministration'

type Props = { currentUserId: number }

export function UserAdministration({ currentUserId }: Props) {
  const {
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
  } = useUserAdministration()
  return (
    <section className="league-discovery user-administration">
      {query.status === 'loading' && <p>Loading…</p>}
      {query.error && (
        <p className="discovery-error" role="alert">
          {query.error}
        </p>
      )}
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
          placeholder="Search by username or account ID"
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
              <small>{`User #${user.id}`}</small>
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
      {query.status === 'success' && totalItems === 0 && (
        <p className="empty-text">No users match this search.</p>
      )}
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
