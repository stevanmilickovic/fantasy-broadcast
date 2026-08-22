import { useEffect, useState } from 'react'
import { loadRegisteredLeagues, registerLeague } from '../../api/customerApi'
import { loadLeagueDiscovery } from '../../api/fplDiscoveryApi'
import type { FplLeagueType } from '../../api/liveApi'
import type { RegisteredLeague } from '../../types/customer'
import type { LeagueDiscoveryState } from '../../types/fpl'
import { LeagueDiscoverySummary } from '../discovery/LeagueDiscoverySummary'

type Props = { token: string }

export function CustomerDashboard({ token }: Props) {
  const [leagues, setLeagues] = useState<RegisteredLeague[]>([])
  const [leagueId, setLeagueId] = useState('')
  const [leagueType, setLeagueType] = useState<FplLeagueType>('DRAFT')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [discovery, setDiscovery] = useState<LeagueDiscoveryState | null>(null)

  const refresh = async () => setLeagues(await loadRegisteredLeagues(token))
  useEffect(() => { void refresh().catch((error: Error) => setMessage(error.message)) }, [token])

  const addLeague = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      await registerLeague(token, leagueId, leagueType)
      await refresh()
      setLeagueId('')
      setMessage('League registered. Its broadcast is currently inactive.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to register league.') }
    finally { setBusy(false) }
  }

  const viewData = async (league: RegisteredLeague) => {
    if (league.leagueType === 'CLASSIC') {
      setMessage('Classic H2H data viewing will be added with the Classic league screen.')
      return
    }
    setBusy(true)
    try { setDiscovery(await loadLeagueDiscovery(String(league.fplLeagueId))); setMessage(null) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load FPL data.') }
    finally { setBusy(false) }
  }

  return <main className="customer-shell">
    <section className="customer-header"><span className="kicker">Your account</span><h1>Your leagues</h1><p>Register a Fantasy Premier League competition to prepare its broadcast.</p></section>
    <section className="league-discovery"><div className="discovery-form"><div><h2>Register a league</h2></div>
      <form onSubmit={addLeague}>
        <label>League ID</label><input inputMode="numeric" value={leagueId} onChange={(event) => setLeagueId(event.target.value)} required />
        <label>League type</label><select value={leagueType} onChange={(event) => setLeagueType(event.target.value as FplLeagueType)}><option value="DRAFT">Draft</option><option value="CLASSIC">Classic head-to-head</option></select>
        <button disabled={busy}>Register league</button>
      </form>
    </div>{message && <p className="discovery-error">{message}</p>}</section>
    <section className="customer-leagues"><h2>Registered leagues</h2>
      {leagues.length === 0 ? <p>No leagues registered yet.</p> : <div className="league-cards">{leagues.map((league) => <article className="league-card" key={league.id}>
        <span>{league.leagueType === 'DRAFT' ? 'Draft' : 'Classic H2H'}</span><h3>{league.displayName}</h3><p>FPL league {league.fplLeagueId}</p>
        <button className="secondary-action" onClick={() => void viewData(league)} disabled={busy}>View FPL data</button>
        <button disabled>Enter broadcast · inactive</button>
      </article>)}</div>}
    </section>
    {discovery && <section className="league-discovery"><LeagueDiscoverySummary discovery={discovery} /></section>}
  </main>
}
