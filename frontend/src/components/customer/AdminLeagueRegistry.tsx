import { useEffect, useState } from 'react'
import { loadAdminLeagues, registerLeague, updateAdminLeague } from '../../api/customerApi'
import type { FplLeagueType } from '../../api/liveApi'
import type { AdminLeague } from '../../types/customer'

type Props = { token: string; onOpenLeague: (leagueId: number) => void }

export function AdminLeagueRegistry({ token, onOpenLeague }: Props) {
  const [leagues, setLeagues] = useState<AdminLeague[]>([])
  const [page, setPage] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [leagueId, setLeagueId] = useState('')
  const [leagueType, setLeagueType] = useState<FplLeagueType>('DRAFT')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const pageSize = 10

  const refresh = async (requestedPage = page) => {
    const result = await loadAdminLeagues(token, requestedPage, pageSize, search)
    setLeagues(Array.isArray(result.items) ? result.items : [])
    setPage(result.page)
    setTotalItems(result.totalItems)
  }

  useEffect(() => { void refresh(page).catch((error: Error) => setMessage(error.message)) }, [token, page, search])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      await registerLeague(token, leagueId, leagueType)
      setPage(0)
      await refresh(0)
      setLeagueId('')
      setMessage('League registered.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to register league.')
    } finally {
      setBusy(false)
    }
  }

  const save = async (league: AdminLeague) => {
    setBusy(true)
    try {
      await updateAdminLeague(token, league)
      await refresh()
      setMessage(`Saved settings for ${league.displayName}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save league settings.')
    } finally {
      setBusy(false)
    }
  }

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault()
    setPage(0)
    setSearch(searchInput.trim())
  }

  const clearSearch = () => {
    setSearchInput('')
    setSearch('')
    setPage(0)
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  return <section className="league-discovery admin-registry"><div className="discovery-form"><div><span className="kicker">Administrator</span><h2>League settings</h2></div>
    <form className="administration-register-form" onSubmit={submit}><div className="administration-form-field"><label>FPL league ID</label><input inputMode="numeric" value={leagueId} onChange={(event) => setLeagueId(event.target.value)} required /></div>
      <div className="administration-form-field"><span>League type</span><select className="administration-select" value={leagueType} onChange={(event) => setLeagueType(event.target.value as FplLeagueType)}><option value="DRAFT">Draft</option><option value="CLASSIC">Classic H2H</option></select></div><button disabled={busy}>Register</button></form>
  </div>{message && <p className="discovery-error">{message}</p>}
  <form className="admin-league-search" onSubmit={submitSearch}><label htmlFor="admin-league-search">Find a league</label><input id="admin-league-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search by league name or FPL ID" /><button type="submit" className="secondary-action">Search</button>{search && <button type="button" className="secondary-action" onClick={clearSearch}>Clear</button>}</form>
  <div className="admin-league-table">{leagues.map((league) => <div className="admin-league-row" key={league.id} onDoubleClick={() => onOpenLeague(league.id)} title="Double-click to open this league"><strong>{league.displayName}</strong><span>{league.leagueType} · #{league.fplLeagueId}</span><span>Owner: {league.ownerEmail ?? '—'}</span><span>Users: {league.registeredUsers ?? '—'}</span><label className="league-enabled"><input type="checkbox" checked={league.serviceEnabled} onChange={(event) => setLeagues((current) => current.map((item) => item.id === league.id ? { ...item, serviceEnabled: event.target.checked } : item))} /> Service enabled</label><small>Registered {new Date(league.createdAt).toLocaleString()}</small><button onClick={() => void save(league)} disabled={busy}>Save settings</button></div>)}</div>
  {totalItems === 0 && <p className="empty-text">No leagues match this search.</p>}
  {totalItems > 0 && <nav className="admin-pagination" aria-label="League settings pages"><button className="secondary-action" disabled={page === 0 || busy} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page + 1} of {totalPages} · {totalItems} leagues</span><button className="secondary-action" disabled={page + 1 >= totalPages || busy} onClick={() => setPage((current) => current + 1)}>Next</button></nav>}
  </section>
}
