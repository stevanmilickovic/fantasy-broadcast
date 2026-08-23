import { useEffect, useState } from 'react'
import { loadActiveBroadcastSchedules, loadClassicLeagueOverview, loadRegisteredLeagues, openLeagueBroadcast, registerLeague, type ClassicLeagueDiscovery } from '../../api/customerApi'
import { loadLeagueDiscovery } from '../../api/fplDiscoveryApi'
import type { FplLeagueScoring, FplLeagueType } from '../../api/liveApi'
import type { AuthUser, BroadcastSchedule, RegisteredLeague } from '../../types/customer'
import type { LeagueDiscoveryState } from '../../types/fpl'
import { LeagueDiscoverySummary } from '../discovery/LeagueDiscoverySummary'
import { enablePointChangeSound } from '../../utils/broadcastSound'

type Props = { token: string; user: AuthUser; pathname: string; search: string; onNavigate: (path: string) => void; onSignOut: () => void }

export function CustomerDashboard({ token, user, pathname, search, onNavigate, onSignOut }: Props) {
  const [leagues, setLeagues] = useState<RegisteredLeague[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [leagueId, setLeagueId] = useState('')
  const [leagueType, setLeagueType] = useState<FplLeagueType>('DRAFT')
  const [discovery, setDiscovery] = useState<LeagueDiscoveryState | null>(null)
  const [activeBroadcasts, setActiveBroadcasts] = useState<BroadcastSchedule[]>([])
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
    if (!selectedLeague || pathname !== '/league') { setDiscovery(null); return }
    setMessage(null); setBusy(true)
    if (selectedLeague.leagueType === 'CLASSIC') {
      setDiscovery(null)
      loadClassicLeagueOverview(token, selectedLeague.id).then((classicDiscovery) => setDiscovery(toLeagueDiscovery(classicDiscovery, selectedLeague.fplLeagueId))).catch((error: Error) => setMessage(error.message)).finally(() => setBusy(false))
      return
    }
    loadLeagueDiscovery(String(selectedLeague.fplLeagueId)).then(setDiscovery).catch((error: Error) => setMessage(error.message)).finally(() => setBusy(false))
  }, [selectedLeague?.id, pathname, token])

  useEffect(() => { void loadActiveBroadcastSchedules(token).then(setActiveBroadcasts).catch(() => setActiveBroadcasts([])) }, [token])

  const register = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true)
    try { const league = await registerLeague(token, leagueId, leagueType); setLeagues(await loadRegisteredLeagues(token)); onNavigate(`/league?leagueId=${league.id}`) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to register league.') }
    finally { setBusy(false) }
  }
  const openBroadcast = async () => {
    if (!selectedLeague) return
    enablePointChangeSound(); setBusy(true)
    try { await openLeagueBroadcast(token, selectedLeague.id); onNavigate(`/broadcast?leagueId=${selectedLeague.id}`) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to open the broadcast.') }
    finally { setBusy(false) }
  }

  return <main className="customer-shell"><CustomerNavigation leagues={leagues} selectedLeague={selectedLeague} user={user} onNavigate={onNavigate} onSignOut={onSignOut} />
    {pathname === '/leagues/new' && <LeagueRegistrationForm leagueId={leagueId} leagueType={leagueType} busy={busy} message={message} onLeagueIdChange={setLeagueId} onLeagueTypeChange={setLeagueType} onSubmit={register} />}
    {pathname === '/leagues' && <LeaguePicker leagues={leagues} user={user} onNavigate={onNavigate} />}
    {pathname === '/league' && selectedLeague && activeBroadcasts.length > 0 && <aside className="customer-broadcast-access"><div><strong>Broadcast live now</strong><span>Available to all registered leagues until {new Date(activeBroadcasts[0].endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.</span></div><button onClick={() => void openBroadcast()} disabled={busy}>Open broadcast</button></aside>}
    {pathname === '/league' && selectedLeague && <section className="selected-league-page">{busy && <p className="league-loading">Loading league data…</p>}{message && <p className="discovery-error">{message}</p>}{discovery && <section className="league-discovery"><LeagueDiscoverySummary discovery={discovery} showMatchups={selectedLeague.scoringType === 'H2H'} showPointsFor={selectedLeague.scoringType === 'H2H'} leagueType={selectedLeague.leagueType} /></section>}</section>}
  </main>
}

function toLeagueDiscovery(classic: ClassicLeagueDiscovery, fplLeagueId: number): LeagueDiscoveryState {
  const entries = classic.entries.map((entry) => ({ id: entry.entryId, entry_id: entry.entryId, entry_name: entry.entryName, player_first_name: entry.playerName, player_last_name: '', short_name: '' }))
  const entryEvents = Object.fromEntries(Object.entries(classic.entryEvents).map(([entryId, event]) => [entryId, {
    picks: event.picks.map((pick) => ({ ...pick, starter: pick.position <= 11, benched: pick.position > 11 })),
  }]))
  return {
    details: { league: { id: fplLeagueId, name: classic.leagueName, draft_status: '', draft_dt: '', max_entries: entries.length, min_entries: 0, scoring: classic.scoringType, start_event: 0, stop_event: 0 }, league_entries: entries,
      matches: classic.matches.map((match, index) => ({ id: index, event: classic.gameweek, league_entry_1: match.firstEntryId, league_entry_2: match.secondEntryId, league_entry_1_points: match.firstPoints, league_entry_2_points: match.secondPoints, finished: false })),
      standings: classic.entries.map((entry) => ({ league_entry: entry.entryId, rank: entry.rank, total: entry.total, points_for: entry.pointsFor })) },
    elementStatus: { element_status: classic.entries.flatMap((entry) => (classic.entryEvents[String(entry.entryId)]?.picks ?? []).map((pick) => ({ element: pick.element, owner: entry.entryId, status: 'o', in_accepted_trade: false }))) },
    players: classic.players,
    entryEvents,
    livePlayers: classic.livePlayers,
  }
}

function CustomerNavigation({ leagues, selectedLeague, user, onNavigate, onSignOut }: { leagues: RegisteredLeague[]; selectedLeague: RegisteredLeague | null; user: AuthUser; onNavigate: (path: string) => void; onSignOut: () => void }) {
  return <nav className="customer-navigation"><span className="brand-name">Fantasy Broadcast</span><div className="customer-navigation-actions">{selectedLeague && <details className="league-switcher"><summary>{selectedLeague.displayName}</summary><div>{leagues.map((league) => <button type="button" key={league.id} onClick={() => onNavigate(`/league?leagueId=${league.id}`)}>{league.displayName} · {scoringLabel(league.scoringType)}</button>)}<button type="button" className="switcher-add" onClick={() => onNavigate('/leagues/new')}>Add a new league</button></div></details>}<details className="profile-menu"><summary>Profile</summary><div><strong>{user.displayName}</strong><button type="button" onClick={onSignOut}>Sign out</button></div></details></div></nav>
}

function LeagueRegistrationForm({ leagueId, leagueType, busy, message, onLeagueIdChange, onLeagueTypeChange, onSubmit }: { leagueId: string; leagueType: FplLeagueType; busy: boolean; message: string | null; onLeagueIdChange: (value: string) => void; onLeagueTypeChange: (value: FplLeagueType) => void; onSubmit: (event: React.FormEvent) => void }) {
  return <section className="customer-empty"><div className="register-league-card"><span className="kicker">Get started</span><h1>Register a league</h1><p>Enter your FPL league ID to open its league hub.</p><form onSubmit={onSubmit}><label htmlFor="customer-league-id">League ID</label><input id="customer-league-id" inputMode="numeric" value={leagueId} onChange={(event) => onLeagueIdChange(event.target.value)} required /><span className="league-type-label">League type</span><div className="league-type-toggle" role="radiogroup" aria-label="League type"><button type="button" role="radio" aria-checked={leagueType === 'DRAFT'} className={leagueType === 'DRAFT' ? 'selected' : ''} onClick={() => onLeagueTypeChange('DRAFT')}>Draft</button><button type="button" role="radio" aria-checked={leagueType === 'CLASSIC'} className={leagueType === 'CLASSIC' ? 'selected' : ''} onClick={() => onLeagueTypeChange('CLASSIC')}>Classic</button></div><button type="submit" disabled={busy}>{busy ? 'Registering…' : 'Register league'}</button></form>{message && <p className="discovery-error">{message}</p>}</div></section>
}

function LeaguePicker({ leagues, user, onNavigate }: { leagues: RegisteredLeague[]; user: AuthUser; onNavigate: (path: string) => void }) {
  return <section className="league-picker"><header><span className="kicker">Welcome back, {user.displayName}</span><h1>Choose a league</h1><p>Select the league you want to open.</p></header><div className="league-cards">{leagues.map((league) => <button type="button" className="league-card" key={league.id} onClick={() => onNavigate(`/league?leagueId=${league.id}`)}><span>{league.leagueType === 'DRAFT' ? 'Draft' : 'Classic'} · {scoringLabel(league.scoringType)}</span><strong>{league.displayName}</strong><small>FPL league #{league.fplLeagueId}</small></button>)}</div><button type="button" className="secondary-action add-league-card" onClick={() => onNavigate('/leagues/new')}>Add a new league</button></section>
}

function scoringLabel(scoringType: FplLeagueScoring) { return scoringType === 'H2H' ? 'Head-to-head' : 'Total points' }
