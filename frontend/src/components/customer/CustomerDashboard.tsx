import { useEffect, useState } from 'react'
import { loadRegisteredLeagues, registerLeague } from '../../api/customerApi'
import { loadLeagueDiscovery } from '../../api/fplDiscoveryApi'
import type { FplLeagueType } from '../../api/liveApi'
import type { AuthUser, RegisteredLeague } from '../../types/customer'
import type { LeagueDiscoveryState } from '../../types/fpl'
import { LeagueDiscoverySummary } from '../discovery/LeagueDiscoverySummary'

type Props = { token: string; user: AuthUser; pathname: string; search: string; onNavigate: (path: string) => void; onSignOut: () => void }

export function CustomerDashboard({ token, user, pathname, search, onNavigate, onSignOut }: Props) {
  const [leagues, setLeagues] = useState<RegisteredLeague[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [leagueId, setLeagueId] = useState('')
  const [leagueType, setLeagueType] = useState<FplLeagueType>('DRAFT')
  const [discovery, setDiscovery] = useState<LeagueDiscoveryState | null>(null)
  const selectedLeagueId = Number(new URLSearchParams(search).get('leagueId'))
  const selectedLeague = leagues.find((league) => league.id === selectedLeagueId) ?? null

  useEffect(() => {
    loadRegisteredLeagues(token).then((nextLeagues) => {
      setLeagues(nextLeagues)
      if (pathname === '/leagues/new') return
      if (nextLeagues.length === 0) onNavigate('/leagues/new')
      else if (nextLeagues.length === 1) onNavigate(`/league?leagueId=${nextLeagues[0].id}`)
      else if (pathname !== '/leagues' && !nextLeagues.some((league) => league.id === selectedLeagueId)) onNavigate('/leagues')
    }).catch((error: Error) => setMessage(error.message))
  }, [token])

  useEffect(() => {
    if (!selectedLeague || pathname !== '/league') return
    if (selectedLeague.leagueType === 'CLASSIC') { setDiscovery(null); setMessage('Classic head-to-head league details will be added with the Classic league screen.'); return }
    setBusy(true)
    loadLeagueDiscovery(String(selectedLeague.fplLeagueId)).then((result) => { setDiscovery(result); setMessage(null) }).catch((error: Error) => setMessage(error.message)).finally(() => setBusy(false))
  }, [selectedLeague?.id, pathname])

  const register = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true)
    try {
      const league = await registerLeague(token, leagueId, leagueType)
      setLeagues(await loadRegisteredLeagues(token)); onNavigate(`/league?leagueId=${league.id}`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to register league.') }
    finally { setBusy(false) }
  }

  return <main className="customer-shell"><CustomerNavigation leagues={leagues} selectedLeague={selectedLeague} user={user} onNavigate={onNavigate} onSignOut={onSignOut} />
    {pathname === '/leagues/new' && <LeagueRegistrationForm leagueId={leagueId} leagueType={leagueType} busy={busy} message={message} onLeagueIdChange={setLeagueId} onLeagueTypeChange={setLeagueType} onSubmit={register} />}
    {pathname === '/leagues' && <LeaguePicker leagues={leagues} user={user} onNavigate={onNavigate} />}
    {pathname === '/league' && selectedLeague && <section className="selected-league-page">{busy && <p className="league-loading">Loading league data…</p>}{message && <p className="discovery-error">{message}</p>}{discovery && <section className="league-discovery"><LeagueDiscoverySummary discovery={discovery} showBroadcastControl /></section>}</section>}
  </main>
}

function CustomerNavigation({ leagues, selectedLeague, user, onNavigate, onSignOut }: { leagues: RegisteredLeague[]; selectedLeague: RegisteredLeague | null; user: AuthUser; onNavigate: (path: string) => void; onSignOut: () => void }) {
  return <nav className="customer-navigation"><span className="brand-name">Fantasy Broadcast</span><div className="customer-navigation-actions">
    {selectedLeague && <details className="league-switcher"><summary>{selectedLeague.displayName}</summary><div>{leagues.map((league) => <button type="button" key={league.id} onClick={() => onNavigate(`/league?leagueId=${league.id}`)}>{league.displayName}</button>)}<button type="button" className="switcher-add" onClick={() => onNavigate('/leagues/new')}>Add a new league</button></div></details>}
    <details className="profile-menu"><summary>Profile</summary><div><strong>{user.displayName}</strong><button type="button" onClick={onSignOut}>Sign out</button></div></details>
  </div></nav>
}

function LeagueRegistrationForm({ leagueId, leagueType, busy, message, onLeagueIdChange, onLeagueTypeChange, onSubmit }: { leagueId: string; leagueType: FplLeagueType; busy: boolean; message: string | null; onLeagueIdChange: (value: string) => void; onLeagueTypeChange: (value: FplLeagueType) => void; onSubmit: (event: React.FormEvent) => void }) {
  return <section className="customer-empty"><div className="register-league-card"><span className="kicker">Get started</span><h1>Register a league</h1><p>Enter your FPL league ID to open its league hub.</p><form onSubmit={onSubmit}><label htmlFor="customer-league-id">League ID</label><input id="customer-league-id" inputMode="numeric" value={leagueId} onChange={(event) => onLeagueIdChange(event.target.value)} required /><span className="league-type-label">League type</span><div className="league-type-toggle" role="radiogroup" aria-label="League type"><button type="button" role="radio" aria-checked={leagueType === 'DRAFT'} className={leagueType === 'DRAFT' ? 'selected' : ''} onClick={() => onLeagueTypeChange('DRAFT')}>Draft</button><button type="button" role="radio" aria-checked={leagueType === 'CLASSIC'} className={leagueType === 'CLASSIC' ? 'selected' : ''} onClick={() => onLeagueTypeChange('CLASSIC')}>Classic H2H</button></div><button type="submit" disabled={busy}>{busy ? 'Registering…' : 'Register league'}</button></form>{message && <p className="discovery-error">{message}</p>}</div></section>
}

function LeaguePicker({ leagues, user, onNavigate }: { leagues: RegisteredLeague[]; user: AuthUser; onNavigate: (path: string) => void }) {
  return <section className="league-picker"><header><span className="kicker">Welcome back, {user.displayName}</span><h1>Choose a league</h1><p>Select the league you want to open.</p></header><div className="league-cards">{leagues.map((league) => <button type="button" className="league-card" key={league.id} onClick={() => onNavigate(`/league?leagueId=${league.id}`)}><span>{league.leagueType === 'DRAFT' ? 'Draft league' : 'Classic H2H'}</span><strong>{league.displayName}</strong><small>FPL league #{league.fplLeagueId}</small></button>)}</div><button type="button" className="secondary-action add-league-card" onClick={() => onNavigate('/leagues/new')}>Add a new league</button></section>
}
