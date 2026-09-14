import type { CSSProperties } from 'react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowUp, Check, CircleCheck, Minus, Sparkles } from 'lucide-react'
import { createPaddleCheckout, deleteOwnedLeague, followLeague, loadActiveBroadcastSchedules, loadClassicLeagueOverview, loadDraftLeagueOverview, loadFplShirts, loadLeagueRegistrationAccess, loadRegisteredLeagues, openLeagueBroadcast, previewLeaguePayment, requestAccountDeletion, searchRegisteredLeagues, type ClassicLeagueDiscovery, type LeaguePaymentPreview } from '../../api/customerApi'
import { openPaddleCheckout } from '../../utils/paddleCheckout'
import type { FplLeagueScoring, FplLeagueType } from '../../api/liveApi'
import type { AuthUser, BroadcastSchedule, RegisteredLeague } from '../../types/customer'
import type { FplStanding, LeagueDiscoveryState } from '../../types/fpl'
import { enablePointChangeSound } from '../../utils/broadcastSound'
import { LegalFooter } from './LegalFooter'

type Props = { user: AuthUser; pathname: string; search: string; onNavigate: (path: string) => void; onSignOut: () => void }
type LeagueDisplayMode = 'standings' | 'teams' | 'matchups'
type FplClubShirt = { name: string; shortName?: string; code: number }
type LeaguePlayer = { id: number; name: string; fullName: string; club: string; position: string; points: number; minutes: number; starter: boolean; lineupPosition: number }

export function CustomerDashboard({ user, pathname, search, onNavigate, onSignOut }: Props) {
	const token = ''
  const [leagues, setLeagues] = useState<RegisteredLeague[]>([]); const [busy, setBusy] = useState(false); const [message, setMessage] = useState<string | null>(null)
	const registrationMessage: string | null = null; const [searchMessage, setSearchMessage] = useState<string | null>(null)
  const [leagueId, setLeagueId] = useState(''); const [leagueType, setLeagueType] = useState<FplLeagueType>('DRAFT'); const [discovery, setDiscovery] = useState<LeagueDiscoveryState | null>(null)
  const [activeBroadcasts, setActiveBroadcasts] = useState<BroadcastSchedule[]>([]); const [searchResults, setSearchResults] = useState<RegisteredLeague[]>([])
  const [canRegisterLeague, setCanRegisterLeague] = useState<boolean | null>(null)
  const [deletionRequestMessage, setDeletionRequestMessage] = useState<string | null>(null)
  const selectedLeagueId = Number(new URLSearchParams(search).get('leagueId')); const selectedLeague = leagues.find((league) => league.id === selectedLeagueId) ?? null
  useEffect(() => { loadRegisteredLeagues().then((nextLeagues) => { setLeagues(nextLeagues); if (pathname === '/leagues/new') return; if (nextLeagues.length === 0) onNavigate('/leagues/new'); else if (nextLeagues.length === 1) onNavigate(`/league?leagueId=${nextLeagues[0].id}`); else if (pathname !== '/leagues' && !nextLeagues.some((league) => league.id === selectedLeagueId)) onNavigate('/leagues') }).catch((error: Error) => setMessage(error.message)) }, [])
  useEffect(() => { if (!selectedLeague || pathname !== '/league') { setDiscovery(null); return }; setMessage(null); setBusy(true); if (selectedLeague.leagueType === 'CLASSIC') { setDiscovery(null); loadClassicLeagueOverview(token, selectedLeague.id).then((classic) => setDiscovery(toLeagueDiscovery(classic, selectedLeague.fplLeagueId))).catch((error: Error) => setMessage(error.message)).finally(() => setBusy(false)); return }; loadDraftLeagueOverview(token, selectedLeague.id).then(setDiscovery).catch((error: Error) => setMessage(error.message)).finally(() => setBusy(false)) }, [selectedLeague?.id, pathname, token])
  useEffect(() => { void loadActiveBroadcastSchedules().then(setActiveBroadcasts).catch(() => setActiveBroadcasts([])) }, [])
  useEffect(() => { void loadLeagueRegistrationAccess().then((access) => setCanRegisterLeague(access.canRegisterLeague)).catch((error: Error) => setMessage(error.message)) }, [])
  const register = (event: React.FormEvent) => { event.preventDefault(); onNavigate(`/leagues/checkout?${new URLSearchParams({ fplLeagueId: leagueId, leagueType })}`) }
  const searchRegistered = async (query: string) => { setSearchMessage(null); setBusy(true); try { setSearchResults(await searchRegisteredLeagues(token, query)) } catch { setSearchResults([]) } finally { setBusy(false) } }
  const follow = async (league: RegisteredLeague) => { setSearchMessage(null); setBusy(true); try { await followLeague(token, league.id); setLeagues(await loadRegisteredLeagues(token)); onNavigate(`/league?leagueId=${league.id}`) } catch (error) { setSearchMessage(error instanceof Error ? error.message : 'Unable to follow the league.') } finally { setBusy(false) } }
  const openBroadcast = async () => { if (!selectedLeague) return; enablePointChangeSound(); setBusy(true); try { await openLeagueBroadcast(token, selectedLeague.id); onNavigate(`/broadcast?leagueId=${selectedLeague.id}`) } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to open the broadcast.') } finally { setBusy(false) } }
  const deleteLeague = async () => { if (!selectedLeague || !window.confirm(`Delete ${selectedLeague.displayName}? This removes it for everyone following it.`)) return; setBusy(true); try { await deleteOwnedLeague(token, selectedLeague.id); const next = await loadRegisteredLeagues(token); setLeagues(next); onNavigate(next.length === 0 ? '/leagues/new' : next.length === 1 ? `/league?leagueId=${next[0].id}` : '/leagues') } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to delete the league.') } finally { setBusy(false) } }
  const requestDeletion = async () => { if (!window.confirm('Request deletion of your Fantasy Broadcast account? Active subscriptions must be cancelled before the request can be completed.')) return; setBusy(true); try { setDeletionRequestMessage((await requestAccountDeletion()).message) } catch (error) { setDeletionRequestMessage(error instanceof Error ? error.message : 'Unable to submit your deletion request.') } finally { setBusy(false) } }
  return <main className="customer-shell"><CustomerNavigation leagues={leagues} selectedLeague={selectedLeague} user={user} onNavigate={onNavigate} onSignOut={onSignOut} />
    {pathname === '/leagues/new' && <LeagueRegistrationForm canRegisterLeague={canRegisterLeague === true} leagueId={leagueId} leagueType={leagueType} busy={busy} registrationMessage={registrationMessage} searchMessage={searchMessage} searchResults={searchResults} user={user} onLeagueIdChange={setLeagueId} onLeagueTypeChange={setLeagueType} onSubmit={register} onSearch={searchRegistered} onFollow={follow} />}
    {pathname === '/leagues/checkout' && <LeagueCheckoutProfessional search={search} onNavigate={onNavigate} />}
    {pathname === '/leagues' && <LeaguePicker leagues={leagues} user={user} onNavigate={onNavigate} />}
    {pathname === '/league' && selectedLeague && activeBroadcasts.length > 0 && <aside className="customer-broadcast-access"><div><strong>Broadcast live now</strong><span>Available to all registered leagues until {new Date(activeBroadcasts[0].endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.</span></div><button onClick={() => void openBroadcast()} disabled={busy}>Open broadcast</button></aside>}
    {pathname === '/league' && selectedLeague && <section className="selected-league-page">{busy && <p className="league-loading">Loading league data…</p>}{message && <p className="discovery-error">{message}</p>}{discovery && <LeagueStandingsOverview token={token} discovery={discovery} scoringType={selectedLeague.scoringType} />}{discovery && selectedLeague.ownerUserId === user.id && <details className="league-actions-menu"><summary aria-label="League actions">...</summary><div><button type="button" className="delete-owned-league" onClick={() => void deleteLeague()} disabled={busy}>Delete my league</button></div></details>}</section>}
    {pathname === '/account-deletion' && <section className="account-deletion-request"><span className="kicker">Account and data</span><h1>Request account deletion</h1><p>We will delete your Fantasy Broadcast account and associated personal data unless we need to retain limited information for legal, security, fraud-prevention, or accounting purposes.</p><p>If you have an active subscription, cancel it through Paddle first. Your request will then be reviewed before deletion is completed.</p>{deletionRequestMessage && <p className="account-deletion-message">{deletionRequestMessage}</p>}<button type="button" className="secondary-action" onClick={() => void requestDeletion()} disabled={busy || Boolean(deletionRequestMessage)}>Request account deletion</button></section>}
    <LegalFooter onNavigate={onNavigate} className="customer-legal-footer" />
  </main>
}

export function LeagueCheckout({ search, onNavigate }: { search: string; onNavigate: (path: string) => void }) {
  const parameters = new URLSearchParams(search)
  const [leagueId, setLeagueId] = useState(parameters.get('fplLeagueId') ?? '')
  const [leagueType, setLeagueType] = useState<FplLeagueType>((parameters.get('leagueType') as FplLeagueType) ?? 'DRAFT')
  const [preview, setPreview] = useState<LeaguePaymentPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { if (!leagueId) return; setPreview(null); setError(null); void previewLeaguePayment(leagueId, leagueType).then((result) => { setPreview(result); setError(result.validationMessage) }).catch((reason: Error) => setError(reason.message)) }, [leagueId, leagueType])
  return <section className="customer-empty league-onboarding"><div className="register-league-card"><span className="kicker">League registration</span><h1>Choose your broadcast</h1><label htmlFor="payment-league-id">League ID</label><input id="payment-league-id" inputMode="numeric" value={leagueId} onChange={(event) => setLeagueId(event.target.value)} /><div className="league-type-toggle" role="radiogroup"><button type="button" className={leagueType === 'DRAFT' ? 'selected' : ''} onClick={() => setLeagueType('DRAFT')}>Draft</button><button type="button" className={leagueType === 'CLASSIC' ? 'selected' : ''} onClick={() => setLeagueType('CLASSIC')}>Classic</button></div>{preview && <p><strong>{preview.displayName}</strong><br />{preview.managerCount} managers</p>}{error && <p className="discovery-error">{error}</p>}<div className="league-type-toggle"><button type="button" disabled={!preview || !preview.checkoutReady}><strong>Standard · €4.99</strong><br /><small>Live broadcast essentials</small></button><button type="button" disabled={!preview || !preview.checkoutReady}><strong>AI Broadcaster · €14.99</strong><br /><small>AI commentary and voice narration</small></button></div>{preview && !preview.checkoutReady && <p className="empty-text">Paddle sandbox will become available here once its credentials and price IDs are configured.</p>}<button type="button" className="secondary-action" onClick={() => onNavigate('/leagues/new')}>Back</button></div></section>
}

function LeagueCheckoutProfessional({ search, onNavigate }: { search: string; onNavigate: (path: string) => void }) {
  const parameters = new URLSearchParams(search)
  const [leagueId, setLeagueId] = useState(parameters.get('fplLeagueId') ?? '')
  const [leagueType, setLeagueType] = useState<FplLeagueType>((parameters.get('leagueType') as FplLeagueType) ?? 'DRAFT')
  const [preview, setPreview] = useState<LeaguePaymentPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openingPlan, setOpeningPlan] = useState<'STANDARD' | 'AI_BROADCASTER' | null>(null)
  const [acceptedPolicies, setAcceptedPolicies] = useState(false)
  useEffect(() => { if (!leagueId) return; setPreview(null); setError(null); void previewLeaguePayment(leagueId, leagueType).then(setPreview).catch((reason: Error) => setError(reason.message)) }, [leagueId, leagueType])
  const leagueIsValid = preview?.registrationEligible === true
  const openCheckout = async (plan: 'STANDARD' | 'AI_BROADCASTER') => {
    setError(null); setOpeningPlan(plan)
    try { await openPaddleCheckout(await createPaddleCheckout(leagueId, leagueType, plan)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to open checkout.') }
    finally { setOpeningPlan(null) }
  }
  useEffect(() => {
    const handlePlanSelection = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('.checkout-plan > button') : null
      if (!button || button.disabled || openingPlan) return
      void openCheckout(button.textContent?.includes('AI Broadcaster') ? 'AI_BROADCASTER' : 'STANDARD')
    }
    document.addEventListener('click', handlePlanSelection)
    return () => document.removeEventListener('click', handlePlanSelection)
  }, [leagueId, leagueType, openingPlan])
  return <main className="league-checkout-page"><button type="button" className="checkout-back" onClick={() => onNavigate('/leagues/new')}><ArrowLeft size={17} /> Back to league ID</button><header className="checkout-heading"><span className="kicker">Fantasy Broadcast</span><h1>Bring your league to the broadcast.</h1><p>Choose a monthly plan for this league. Once registered, everyone who follows it in Fantasy Broadcast can watch its live matchday broadcast.</p></header><section className="checkout-layout"><aside className="checkout-league-card"><div><span className="checkout-eyebrow">Your league</span><strong>{preview?.displayName ?? 'Looking up your league…'}{leagueIsValid && <CircleCheck className="league-verified" size={23} aria-label="League verified" />}</strong><span>{preview ? `${preview.managerCount} managers · ${leagueType === 'DRAFT' ? 'Draft' : 'Classic'} league` : 'Checking FPL data'}</span></div><div className="checkout-league-controls"><label htmlFor="payment-league-id-professional">FPL league ID</label><div className="checkout-id-field"><input id="payment-league-id-professional" inputMode="numeric" value={leagueId} onChange={(event) => setLeagueId(event.target.value)} /></div><div className="checkout-league-types" role="radiogroup"><button type="button" className={leagueType === 'DRAFT' ? 'selected' : ''} onClick={() => setLeagueType('DRAFT')}>Draft</button><button type="button" className={leagueType === 'CLASSIC' ? 'selected' : ''} onClick={() => setLeagueType('CLASSIC')}>Classic</button></div></div>{error && <p className="discovery-error">{error}</p>}</aside><section className="checkout-plans" aria-label="Broadcast plans"><article className="checkout-plan"><span>Standard</span><h2>€4.99</h2><p>Per league, per month · Renews monthly during the season</p><ul><li><Check size={16} /> Live matchday broadcast</li><li><Check size={16} /> League standings and teams</li><li><Check size={16} /> Fixture and score updates</li></ul><button type="button" disabled={!leagueIsValid || !preview.checkoutReady || !acceptedPolicies}>Choose Standard</button></article><article className="checkout-plan featured"><span className="plan-badge"><Sparkles size={14} /> Recommended</span><h2>€14.99</h2><p>Per league, per month · Renews monthly during the season</p><h3>AI Broadcaster</h3><ul><li><Check size={16} /> Everything in Standard</li><li><Check size={16} /> AI match commentary</li><li><Check size={16} /> Natural voice narration</li></ul><button type="button" disabled={!leagueIsValid || !preview.checkoutReady || !acceptedPolicies}>Choose AI Broadcaster</button></article></section></section>{preview && !preview.checkoutReady && <p className="checkout-notice">Checkout is being prepared. Add the Paddle sandbox credentials and price IDs to enable secure payment testing.</p>}<label className="checkout-consent"><input type="checkbox" checked={acceptedPolicies} onChange={(event) => setAcceptedPolicies(event.target.checked)} /><span>By continuing, you agree to our <button type="button" onClick={() => onNavigate('/terms')}>Terms of Service</button> and acknowledge our <button type="button" onClick={() => onNavigate('/privacy')}>Privacy Policy</button>.</span></label><p className="checkout-security">Secure payment powered by Paddle · Your card details never reach Fantasy Broadcast · Final price and any applicable taxes are shown before you pay</p></main>
}

function toLeagueDiscovery(classic: ClassicLeagueDiscovery, fplLeagueId: number): LeagueDiscoveryState {
  const entries = classic.entries.map((entry) => ({ id: entry.entryId, entry_id: entry.entryId, entry_name: entry.entryName, player_first_name: entry.playerName, player_last_name: '', short_name: '' }))
  const entryEvents = Object.fromEntries(Object.entries(classic.entryEvents).map(([id, event]) => [id, { picks: event.picks.map((pick) => ({ ...pick, starter: pick.position <= 11, benched: pick.position > 11 })), automaticSubstitutions: event.automaticSubstitutions }]))
  return { gameweek: classic.gameweek, details: { league: { id: fplLeagueId, name: classic.leagueName, draft_status: '', draft_dt: '', max_entries: entries.length, min_entries: 0, scoring: classic.scoringType, start_event: 0, stop_event: 0 }, league_entries: entries, matches: classic.matches.map((match, index) => ({ id: index, event: classic.gameweek, league_entry_1: match.firstEntryId, league_entry_2: match.secondEntryId, league_entry_1_points: match.firstPoints, league_entry_2_points: match.secondPoints, finished: false })), standings: classic.entries.map((entry) => ({ league_entry: entry.entryId, rank: entry.rank, lastRank: entry.lastRank, total: entry.total, points_for: entry.pointsFor })) }, elementStatus: { element_status: classic.entries.flatMap((entry) => (classic.entryEvents[String(entry.entryId)]?.picks ?? []).map((pick) => ({ element: pick.element, owner: entry.entryId, status: 'o', in_accepted_trade: false }))) }, players: classic.players, entryEvents, livePlayers: classic.livePlayers }
}

function OwnerBadge() { return <span className="owner-badge">My league</span> }
export function LeagueStandingsOverview({ token, discovery, scoringType }: { token: string; discovery: LeagueDiscoveryState; scoringType: FplLeagueScoring }) {
  const [mode, setMode] = useState<LeagueDisplayMode>('standings')
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null)
  const [teamSearch, setTeamSearch] = useState('')
  const [hasManagerOverflow, setHasManagerOverflow] = useState(false)
  const managerListRef = useRef<HTMLDivElement>(null)
  const shirtCodes = useShirtCodes(token)
  const { details } = discovery
  const showGamePoints = scoringType === 'H2H'
  const entries = details.league_entries ?? []
  const entriesByLeagueEntryId = new Map(entries.map((entry) => [entry.id, entry]))
  const entriesByEntryId = new Map(entries.map((entry) => [entry.entry_id, entry]))
  const selectedEntry = entries.find((entry) => entry.entry_id === selectedEntryId) ?? null
  const standings = (details.standings ?? []).slice().sort((first, second) => first.rank - second.rank || standingPoints(second) - standingPoints(first))
  const podiumGroups = groupedStandings(standings).slice(0, 3)
  const podiumEntryIds = new Set(podiumGroups.flatMap((group) => group.standings.map(standingEntryId)))
  const remainingStandings = standings.filter((standing) => !podiumEntryIds.has(standingEntryId(standing)))
  const matches = (details.matches ?? []).slice().sort((first, second) => first.event - second.event)
  const matchweeks = groupedMatches(matches)
  const currentGameweek = discovery.gameweek ?? matchweeks.find((week) => week.matches.some((match) => !match.finished))?.event ?? matchweeks.at(-1)?.event
  const previousMatchweeks = matchweeks.filter((week) => currentGameweek !== undefined && week.event < currentGameweek)
  const currentMatchweek = matchweeks.find((week) => week.event === currentGameweek)
  const futureMatchweeks = matchweeks.filter((week) => currentGameweek !== undefined && week.event > currentGameweek)
  const renderMatchweek = (week: (typeof matchweeks)[number]) => (
    <section className="matchweek-group" key={week.event}>
      <header><strong>Gameweek {week.event}</strong></header>
      <div>
        {week.matches.map((match, index) => {
          const firstEntryId = match.league_entry_1 ?? match.firstLeagueEntryId ?? 0
          const secondEntryId = match.league_entry_2 ?? match.secondLeagueEntryId ?? 0
          const firstEntry = entriesByLeagueEntryId.get(firstEntryId) ?? entriesByEntryId.get(firstEntryId)
          const secondEntry = entriesByLeagueEntryId.get(secondEntryId) ?? entriesByEntryId.get(secondEntryId)
          const firstPoints = match.league_entry_1_points ?? match.firstPoints ?? 0
          const secondPoints = match.league_entry_2_points ?? match.secondPoints ?? 0
          const played = match.finished || firstPoints > 0 || secondPoints > 0
          const firstResultClass = !played || firstPoints === secondPoints ? '' : firstPoints > secondPoints ? 'winning-score' : 'losing-score'
          const secondResultClass = !played || firstPoints === secondPoints ? '' : secondPoints > firstPoints ? 'winning-score' : 'losing-score'
          return (
            <article className={`league-matchup-row ${played ? 'played' : 'upcoming'}`} key={`${match.event}-${firstEntryId}-${secondEntryId}-${index}`}>
              <strong className="matchup-team home-team">{firstEntry?.entry_name ?? firstEntryId}</strong>
              <div className="matchup-scoreline" aria-label={played ? `${firstPoints} versus ${secondPoints}` : 'Upcoming matchup'}>
                <span className={firstResultClass}>{played ? firstPoints : '-'}</span>
                <b>vs</b>
                <span className={secondResultClass}>{played ? secondPoints : '-'}</span>
              </div>
              <strong className="matchup-team away-team">{secondEntry?.entry_name ?? secondEntryId}</strong>
            </article>
          )
        })}
      </div>
    </section>
  )
  const filteredEntries = entries.filter((entry) => {
    const query = teamSearch.trim().toLowerCase()
    if (!query) return true
    return `${entry.entry_name} ${entry.player_first_name} ${entry.player_last_name}`.toLowerCase().includes(query)
  })

  useEffect(() => {
    const element = managerListRef.current
    if (!element || mode !== 'teams') return
    const updateOverflow = () => setHasManagerOverflow(element.scrollHeight > element.clientHeight + 1)
    const observer = new ResizeObserver(updateOverflow)
    observer.observe(element)
    updateOverflow()
    return () => observer.disconnect()
  }, [mode, entries.length])

  return (
    <section className="selected-league-standings">
      <header className="selected-league-heading">
        <h1>{details.league?.name ?? 'League standings'}</h1>
        <div className="league-view-toggle" role="tablist" aria-label="League display">
          <button type="button" className={mode === 'standings' ? 'selected' : ''} onClick={() => setMode('standings')}>Standings</button>
          <button type="button" className={mode === 'teams' ? 'selected' : ''} onClick={() => setMode('teams')}>Teams</button>
          {showGamePoints && <button type="button" className={mode === 'matchups' ? 'selected' : ''} onClick={() => setMode('matchups')}>Matchups</button>}
        </div>
      </header>

      {mode === 'standings' && (standings.length === 0 ? (
        <p className="empty-text compact-empty">No standings returned by FPL yet.</p>
      ) : (
        <>
          <div className="standings-podium" aria-label="Top standings podium">
            {podiumGroups.map((group, index) => (
              <article className={`podium-step podium-step-${index + 1}`} key={group.rank}>
                <div className="podium-entries">
                  {group.standings.map((standing) => {
                    const entryId = standing.league_entry ?? standing.leagueEntryId ?? 0
                    const entry = entriesByLeagueEntryId.get(entryId) ?? entriesByEntryId.get(entryId)
                    return <div className="podium-entry" key={entryId}><strong>{entry?.entry_name ?? `Entry ${entryId}`}</strong><div className="podium-entry-meta">{showGamePoints && <i className="podium-points-divider">·</i>}<StandingPoints standing={standing} showGamePoints={showGamePoints} /><StandingMovement standing={standing} /></div></div>
                  })}
                </div>
                <div className="podium-base">
                  <strong>{group.rank}</strong>
                  <span>{placeLabel(group.rank)}</span>
                </div>
              </article>
            ))}
          </div>

          {remainingStandings.length > 0 && <div className="standings-list" aria-label="Remaining standings">
            {remainingStandings.map((standing, index) => {
              const entryId = standingEntryId(standing)
              const entry = entriesByLeagueEntryId.get(entryId) ?? entriesByEntryId.get(entryId)
              return (
                <div className="standings-list-row" key={`${entryId}-${index}`}>
                  <strong>{standing.rank || index + 1}</strong>
                  <span>{entry?.entry_name ?? `Entry ${entryId}`}</span>
                  <StandingMovement standing={standing} />
                  <StandingPoints standing={standing} showGamePoints={showGamePoints} />
                </div>
              )
            })}
          </div>}
        </>
      ))}

      {mode === 'teams' && (
        <section className="league-teams-view">
          <div className="league-manager-panel">
            {(hasManagerOverflow || teamSearch) && <input className="manager-search" value={teamSearch} onChange={(event) => setTeamSearch(event.target.value)} placeholder="Search clubs" />}
            <div className="manager-grid" ref={managerListRef}>
              {filteredEntries.map((entry) => (
                <button type="button" className={selectedEntryId === entry.entry_id ? 'selected-manager' : ''} key={entry.entry_id} onClick={() => setSelectedEntryId(entry.entry_id)}>
                  <strong>{entry.entry_name}</strong>
                  <span>{managerName(entry.player_first_name, entry.player_last_name)}</span>
                </button>
              ))}
            </div>
          </div>
          {selectedEntry ? <LeagueTeamVisual discovery={discovery} entryId={selectedEntry.entry_id} entryName={selectedEntry.entry_name} manager={managerName(selectedEntry.player_first_name, selectedEntry.player_last_name)} shirtCodes={shirtCodes} /> : <div className="league-team-empty-card"><strong>Select a club</strong></div>}
        </section>
      )}

      {mode === 'matchups' && showGamePoints && (
        <section className="league-matchups-view">
          {matchweeks.length === 0 ? <p className="empty-text compact-empty">No matchups returned by FPL yet.</p> : <>
            {previousMatchweeks.length > 0 && <details className="matchweek-archive"><summary>Previous matchweeks <span>{previousMatchweeks.length}</span></summary><div>{previousMatchweeks.map(renderMatchweek)}</div></details>}
            {currentMatchweek ? renderMatchweek(currentMatchweek) : <p className="empty-text compact-empty">No matchups for gameweek {currentGameweek} yet.</p>}
            {futureMatchweeks.length > 0 && <details className="matchweek-archive"><summary>Future matchweeks <span>{futureMatchweeks.length}</span></summary><div>{futureMatchweeks.map(renderMatchweek)}</div></details>}
          </>}
        </section>
      )}
    </section>
  )
}

function LeagueTeamVisual({ discovery, entryId, entryName, manager, shirtCodes }: { discovery: LeagueDiscoveryState; entryId: number; entryName: string; manager: string; shirtCodes: FplClubShirt[] }) {
  const stageRef = useRef<HTMLElement>(null)
  const players = leaguePlayersForEntry(discovery, entryId)
  const starters = players.filter((player) => player.starter)
  const bench = players.filter((player) => !player.starter)
  const groups = [
    ['FWD', 'Forwards', starters.filter((player) => player.position === 'FWD')],
    ['MID', 'Midfielders', starters.filter((player) => player.position === 'MID')],
    ['DEF', 'Defenders', starters.filter((player) => player.position === 'DEF')],
    ['GKP', 'Goalkeeper', starters.filter((player) => player.position === 'GKP')],
    ['BENCH', 'Bench', bench],
  ] as const
  useEffect(() => {
    if (!window.matchMedia('(max-width: 700px)').matches) return
    const frame = window.requestAnimationFrame(() => stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    return () => window.cancelAnimationFrame(frame)
  }, [entryId])

  return <section ref={stageRef} className="league-team-stage" aria-label={`${entryName} players`}>
    <header><span>{manager}</span><FitClubName text={entryName} /><strong>{starters.reduce((total, player) => total + player.points, 0)} pts</strong></header>
    <div className="league-total-player-rows">{groups.map(([key, label, groupPlayers]) => groupPlayers.length > 0 && <section className="league-total-player-row" key={key}><span>{label}</span><div>{groupPlayers.map((player, index) => <LeaguePlayerToken key={player.id} player={player} shirtCode={shirtCodeFor(player.club, shirtCodes)} position={rowPlayerPosition(index, groupPlayers.length)} />)}</div></section>)}</div>
  </section>
}

function FitClubName({ text }: { text: string }) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useLayoutEffect(() => {
    const heading = headingRef.current
    if (!heading) return
    let frame = 0
    const fit = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        heading.style.fontSize = ''
        const maxFontSize = parseFloat(window.getComputedStyle(heading).fontSize) || 64
        const minFontSize = 14
        let low = minFontSize
        let high = maxFontSize
        heading.style.fontSize = `${maxFontSize}px`
        if (heading.scrollWidth <= heading.clientWidth) return
        while (high - low > 0.5) {
          const next = (low + high) / 2
          heading.style.fontSize = `${next}px`
          if (heading.scrollWidth <= heading.clientWidth) low = next
          else high = next
        }
        heading.style.fontSize = `${Math.max(minFontSize, low)}px`
      })
    }
    const observer = new ResizeObserver(fit)
    observer.observe(heading.parentElement ?? heading)
    fit()
    document.fonts?.ready.then(fit).catch(() => undefined)
    window.addEventListener('resize', fit)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', fit)
    }
  }, [text])

  return <h2 ref={headingRef} title={text}>{text}</h2>
}

function LeaguePlayerToken({ player, shirtCode, position }: { player: LeaguePlayer; shirtCode?: number; position: { x: number; y: number } }) {
  const shirtUrl = shirtCode ? `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${shirtCode}-110.png` : undefined
  return <div className="league-player-token" style={{ '--x': `${position.x}%`, '--y': `${position.y}%` } as CSSProperties}>
    <div className="player-core">
      <div className="shirt-wrap">{shirtUrl ? <img src={shirtUrl} alt={`${player.club} shirt`} /> : <span>{player.name}</span>}</div>
      <div className="player-meta"><strong>{player.name}</strong><b>{player.points === 0 && player.minutes === 0 ? '-' : player.points}</b></div>
    </div>
  </div>
}
function CustomerNavigation({ leagues, selectedLeague, user, onNavigate, onSignOut }: { leagues: RegisteredLeague[]; selectedLeague: RegisteredLeague | null; user: AuthUser; onNavigate: (path: string) => void; onSignOut: () => void }) { return <nav className="customer-navigation"><button className="customer-brand brand-name" type="button" onClick={() => onNavigate('/leagues')}>Fantasy Broadcast</button><div className="customer-navigation-actions">{selectedLeague && <details className="league-switcher"><summary>{selectedLeague.displayName}{selectedLeague.ownerUserId === user.id && <OwnerBadge />}</summary><div>{leagues.map((league) => <button type="button" key={league.id} onClick={() => onNavigate(`/league?leagueId=${league.id}`)}>{league.displayName} · {scoringLabel(league.scoringType)}{league.ownerUserId === user.id && <OwnerBadge />}</button>)}<button type="button" className="switcher-add" onClick={() => onNavigate('/leagues/new')}>Add or find a league</button></div></details>}<details className="profile-menu"><summary>Profile</summary><div><strong>{user.displayName}</strong><button type="button" onClick={onSignOut}>Sign out</button></div></details></div></nav> }
function LeagueRegistrationForm({ canRegisterLeague, leagueId, leagueType, busy, registrationMessage, searchMessage, searchResults, user, onLeagueIdChange, onLeagueTypeChange, onSubmit, onSearch, onFollow }: { canRegisterLeague: boolean; leagueId: string; leagueType: FplLeagueType; busy: boolean; registrationMessage: string | null; searchMessage: string | null; searchResults: RegisteredLeague[]; user: AuthUser; onLeagueIdChange: (value: string) => void; onLeagueTypeChange: (value: FplLeagueType) => void; onSubmit: (event: React.FormEvent) => void; onSearch: (query: string) => void; onFollow: (league: RegisteredLeague) => void }) {
  const [query, setQuery] = useState('')
  if (!canRegisterLeague) return <ClosedLeagueRegistrationScreen busy={busy} message={searchMessage} searchResults={searchResults} user={user} query={query} onQueryChange={setQuery} onSearch={onSearch} onFollow={onFollow} />
  return <section className="customer-empty league-onboarding">
    <div className="register-league-card"><span className="kicker">Create</span><h1>Register a league</h1><p>Enter your FPL league ID to add a league you manage.</p>
      <form onSubmit={onSubmit}><label htmlFor="customer-league-id">League ID</label><input id="customer-league-id" inputMode="numeric" value={leagueId} onChange={(event) => onLeagueIdChange(event.target.value)} required /><span className="league-type-label">League type</span><div className="league-type-toggle" role="radiogroup"><button type="button" className={leagueType === 'DRAFT' ? 'selected' : ''} onClick={() => onLeagueTypeChange('DRAFT')}>Draft</button><button type="button" className={leagueType === 'CLASSIC' ? 'selected' : ''} onClick={() => onLeagueTypeChange('CLASSIC')}>Classic</button></div><button type="submit" disabled={busy}>{busy ? 'Registering…' : 'Register my league'}</button>{registrationMessage && <p className="discovery-error">{registrationMessage}</p>}</form>
    </div>
    <LeagueSearchCard busy={busy} message={searchMessage} searchResults={searchResults} user={user} query={query} onQueryChange={setQuery} onSearch={onSearch} onFollow={onFollow} />
  </section>
}

function LeagueSearchCard({ busy, message, searchResults, user, query, onQueryChange, onSearch, onFollow }: { busy: boolean; message: string | null; searchResults: RegisteredLeague[]; user: AuthUser; query: string; onQueryChange: (value: string) => void; onSearch: (query: string) => void; onFollow: (league: RegisteredLeague) => void }) {
  const [hasSearched, setHasSearched] = useState(false)
  const noResults = hasSearched && !busy && searchResults.length === 0 && !message
  return <div className="register-league-card find-league-card"><span className="kicker">Follow</span><h1>Find a registered league</h1><p>Search by league name or FPL ID, then follow it.</p><div className="league-search"><div><input id="registered-league-search" value={query} onChange={(event) => { setHasSearched(false); onQueryChange(event.target.value) }} placeholder="League name or ID" /><button type="button" disabled={busy || !query.trim()} onClick={() => { setHasSearched(true); void onSearch(query) }}>Search</button></div>{searchResults.map((league) => <div className="league-search-result" key={league.id}><span><strong>{league.displayName}</strong><small>{league.leagueType === 'DRAFT' ? 'Draft' : 'Classic'} · {scoringLabel(league.scoringType)}{league.ownerUserId === user.id && <OwnerBadge />}</small></span><button type="button" disabled={busy} onClick={() => void onFollow(league)}>Follow</button></div>)}{noResults && <p className="empty-text">No registered leagues found.</p>}</div>{message && <p className="discovery-error">{message}</p>}</div>
}

function ClosedLeagueRegistrationScreen({ busy, message, searchResults, user, query, onQueryChange, onSearch, onFollow }: {
  busy: boolean; message: string | null; searchResults: RegisteredLeague[]; user: AuthUser; query: string; onQueryChange: (value: string) => void; onSearch: (query: string) => void; onFollow: (league: RegisteredLeague) => void
}) {
  return <section className="customer-empty league-onboarding"><div className="register-league-card"><span className="kicker">Test access</span><h1>League registration is closed</h1><p>League registration is closed for this test. Search for the test league below and follow it to continue.</p></div><LeagueSearchCard busy={busy} message={message} searchResults={searchResults} user={user} query={query} onQueryChange={onQueryChange} onSearch={onSearch} onFollow={onFollow} /></section>
}
function LeaguePicker({ leagues, user, onNavigate }: { leagues: RegisteredLeague[]; user: AuthUser; onNavigate: (path: string) => void }) { return <section className="league-picker"><header><span className="kicker">Welcome back, {user.displayName}</span><h1>Choose a league</h1><p>Select the league you want to open.</p></header><div className="league-cards">{leagues.map((league) => <button type="button" className="league-card" key={league.id} onClick={() => onNavigate(`/league?leagueId=${league.id}`)}><span>{league.leagueType === 'DRAFT' ? 'Draft' : 'Classic'} · {scoringLabel(league.scoringType)}{league.ownerUserId === user.id && <OwnerBadge />}</span><strong>{league.displayName}</strong><small>FPL league #{league.fplLeagueId}</small></button>)}</div><button type="button" className="secondary-action add-league-card" onClick={() => onNavigate('/leagues/new')}>Add or find a league</button></section> }
function scoringLabel(scoringType: FplLeagueScoring) { return scoringType === 'H2H' ? 'Head-to-head' : 'Total points' }
function standingPoints(standing: FplStanding) { return standing.total ?? standing.headToHeadPoints ?? 0 }
function standingGamePoints(standing: FplStanding) { return standing.points_for ?? standing.pointsFor ?? 0 }
function standingEntryId(standing: FplStanding) { return standing.league_entry ?? standing.leagueEntryId ?? 0 }
function standingLastRank(standing: FplStanding) { return standing.last_rank ?? standing.lastRank ?? null }
function StandingPoints({ standing, showGamePoints }: { standing: FplStanding; showGamePoints: boolean }) {
  return <small className="standing-points">{showGamePoints && <><span>{standingGamePoints(standing)}</span><i>·</i></>}<b>{standingPoints(standing)} pts</b></small>
}
function StandingMovement({ standing }: { standing: FplStanding }) {
  const lastRank = standingLastRank(standing)
  if (!lastRank || !standing.rank) return null
  const movement = lastRank > standing.rank ? 'up' : lastRank < standing.rank ? 'down' : 'same'
  const label = movement === 'up' ? 'Moved up' : movement === 'down' ? 'Moved down' : 'No movement'
  const Icon = movement === 'up' ? ArrowUp : movement === 'down' ? ArrowDown : Minus
  return <em className={`standing-movement standing-movement-${movement}`} aria-label={label} title={label}><Icon size={13} strokeWidth={3} /></em>
}
function managerName(firstName: string, lastName: string) { return `${firstName} ${lastName}`.trim() || 'Manager' }
function leaguePlayersForEntry(discovery: LeagueDiscoveryState, entryId: number): LeaguePlayer[] {
  const playersById = new Map(discovery.players.map((player) => [player.id, player]))
  const livePlayersById = new Map((discovery.livePlayers ?? []).map((player) => [player.id, player]))
  const entryEvent = discovery.entryEvents?.[String(entryId)]
  const picksByElement = new Map((entryEvent?.picks ?? []).map((pick) => [pick.element, pick]))
  const effectivePositions = new Map((entryEvent?.picks ?? []).map((pick) => [pick.element, pick.position]))
  for (const substitution of entryEvent?.automaticSubstitutions ?? []) {
    const incomingPosition = effectivePositions.get(substitution.elementIn)
    const outgoingPosition = effectivePositions.get(substitution.elementOut)
    if (incomingPosition === undefined || outgoingPosition === undefined) continue
    effectivePositions.set(substitution.elementIn, outgoingPosition)
    effectivePositions.set(substitution.elementOut, incomingPosition)
  }
  return (discovery.elementStatus.element_status ?? [])
    .filter((status) => status.owner === entryId)
    .map((status) => {
      const player = playersById.get(status.element)
      const pick = picksByElement.get(status.element)
      const lineupPosition = effectivePositions.get(status.element) ?? pick?.position ?? 99
      return {
        id: status.element,
        name: player?.webName ?? `Player ${status.element}`,
        fullName: player?.fullName ?? 'Unknown player',
        club: player?.premierLeagueClub ?? 'Unknown club',
        position: player?.position ?? 'MID',
        points: livePlayersById.get(status.element)?.stats.totalPoints ?? 0,
        minutes: livePlayersById.get(status.element)?.stats.minutes ?? 0,
        starter: pick ? lineupPosition <= 11 : true,
        lineupPosition,
      }
    })
    .sort((first, second) => first.lineupPosition - second.lineupPosition || first.name.localeCompare(second.name))
}
function useShirtCodes(token: string) {
  const [codes, setCodes] = useState<FplClubShirt[]>([])
  useEffect(() => {
    if (token === 'demo') return
    let alive = true
    loadFplShirts(token)
      .then((teams: FplClubShirt[]) => { if (alive) setCodes(teams) })
      .catch(() => undefined)
    return () => { alive = false }
  }, [token])
  return codes
}
function rowPlayerPosition(index: number, count: number) {
  if (count === 5 && window.matchMedia('(max-width: 700px)').matches) return { x: 10 + index * 20, y: 50 }
  return { x: ((index + 1) / (count + 1)) * 100, y: 50 }
}
function shirtCodeFor(clubName: string, shirtCodes: FplClubShirt[]) {
  const requestedName = normalizeClubName(clubName)
  const exactMatch = shirtCodes.find((team) => [team.name, team.shortName].some((name) => normalizeClubName(name) === requestedName))
  if (exactMatch) return exactMatch.code
  return shirtCodes
    .map((team) => ({ team, score: Math.max(clubNameSimilarity(requestedName, normalizeClubName(team.name)), clubNameSimilarity(requestedName, normalizeClubName(team.shortName))) }))
    .filter((candidate) => candidate.score >= 50)
    .sort((left, right) => right.score - left.score)[0]?.team.code
}
function normalizeClubName(name: string | undefined) { return (name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() }
function clubNameSimilarity(firstName: string, secondName: string) {
  if (!firstName || !secondName) return 0
  if (firstName.includes(secondName) || secondName.includes(firstName)) return 100
  const firstWords = firstName.split(' ')
  const secondWords = secondName.split(' ')
  return firstWords.filter((word) => secondWords.includes(word)).length * 35
}
function groupedStandings(standings: FplStanding[]) {
  return standings.reduce<Array<{ rank: number; standings: FplStanding[] }>>((groups, standing) => {
    const rank = standing.rank || groups.length + 1
    const existing = groups.find((group) => group.rank === rank)
    if (existing) existing.standings.push(standing)
    else groups.push({ rank, standings: [standing] })
    return groups
  }, [])
}
function groupedMatches(matches: LeagueDiscoveryState['details']['matches']) {
  return matches.reduce<Array<{ event: number; matches: typeof matches }>>((groups, match) => {
    const existing = groups.find((group) => group.event === match.event)
    if (existing) existing.matches.push(match)
    else groups.push({ event: match.event, matches: [match] })
    return groups
  }, [])
}
function placeLabel(rank: number) {
  const tens = rank % 100
  if (tens >= 11 && tens <= 13) return `${rank}th`
  if (rank % 10 === 1) return `${rank}st`
  if (rank % 10 === 2) return `${rank}nd`
  if (rank % 10 === 3) return `${rank}rd`
  return `${rank}th`
}





