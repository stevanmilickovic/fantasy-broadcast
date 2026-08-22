import { useEffect, useState } from 'react'
import { loadAdminLeagues, registerLeague } from '../../api/customerApi'
import type { FplLeagueType } from '../../api/liveApi'
import type { AdminLeague } from '../../types/customer'

type Props = { token: string }

export function AdminLeagueRegistry({ token }: Props) {
  const [leagues, setLeagues] = useState<AdminLeague[]>([])
  const [leagueId, setLeagueId] = useState('')
  const [leagueType, setLeagueType] = useState<FplLeagueType>('DRAFT')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const refresh = async () => setLeagues(await loadAdminLeagues(token))
  useEffect(() => { void refresh().catch((error: Error) => setMessage(error.message)) }, [token])
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true)
    try { await registerLeague(token, leagueId, leagueType); await refresh(); setLeagueId(''); setMessage('League registered.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to register league.') }
    finally { setBusy(false) }
  }
  return <section className="league-discovery admin-registry"><div className="discovery-form"><div><span className="kicker">Administrator</span><h2>Registered leagues</h2></div>
    <form onSubmit={submit}><label>FPL league ID</label><input inputMode="numeric" value={leagueId} onChange={(event) => setLeagueId(event.target.value)} required />
      <select value={leagueType} onChange={(event) => setLeagueType(event.target.value as FplLeagueType)}><option value="DRAFT">Draft</option><option value="CLASSIC">Classic H2H</option></select><button disabled={busy}>Register</button></form>
  </div>{message && <p className="discovery-error">{message}</p>}
  <div className="admin-league-table">{leagues.map((league) => <div key={league.id}><strong>{league.displayName}</strong><span>{league.leagueType} · #{league.fplLeagueId}</span><span>Owner: {league.ownerEmail ?? '—'}</span><span>Users: {league.registeredUsers ?? '—'}</span></div>)}</div></section>
}
