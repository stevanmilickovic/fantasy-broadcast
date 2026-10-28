import { ArrowLeft, Ellipsis, Radio } from 'lucide-react'
import { useDismissibleMenus } from './useDismissibleMenus'
import { useCallback } from 'react'
import type { Navigate } from '../../app/useBrowserNavigation'
import { useMutation } from '../../shared/api/useMutation'
import { useQuery } from '../../shared/api/useQuery'
import type { AuthUser } from '../auth/types'
import { enablePointChangeSound } from '../broadcast/broadcastSound'
import {
  deleteOwnedLeague,
  loadActiveBroadcastSchedules,
  loadClassicLeagueOverview,
  loadDraftLeagueOverview,
  openLeagueBroadcast,
} from './api'
import { scoringLabel, toLeagueDiscovery } from './leagueData'
import { LeagueStandingsOverview } from './LeagueStandingsOverview'
import type { RegisteredLeague } from './types'

export function LeagueDetailPage({
  league,
  search,
  user,
  navigate,
  onDeleted,
}: {
  league: RegisteredLeague
  search: string
  user: AuthUser
  navigate: Navigate
  onDeleted: () => void
}) {
  const menuRef = useDismissibleMenus()
  const load = useCallback(
    async (signal: AbortSignal) =>
      league.leagueType === 'CLASSIC'
        ? toLeagueDiscovery(await loadClassicLeagueOverview(league.id, signal), league.fplLeagueId)
        : loadDraftLeagueOverview(league.id, signal),
    [league.id, league.leagueType, league.fplLeagueId],
  )
  const discovery = useQuery(String(league.id), load)
  const schedules = useQuery('active-broadcasts', loadActiveBroadcastSchedules)
  const opening = useMutation()
  const deleting = useMutation()
  const open = async () => {
    enablePointChangeSound()
    if (await opening.run((signal) => openLeagueBroadcast(league.id, signal)))
      navigate(`/broadcast?leagueId=${league.id}`)
  }
  const remove = async () => {
    if (!window.confirm(`Delete ${league.displayName}? This removes it for everyone following it.`))
      return
    if (await deleting.run((signal) => deleteOwnedLeague(league.id, signal))) {
      onDeleted()
      navigate('/leagues')
    }
  }
  const active = schedules.data?.[0]
  return (
    <section className="selected-league-page">
      <a className="league-back" href="/leagues">
        <ArrowLeft size={16} /> Your leagues
      </a>
      <header className="league-identity">
        <div>
          <h1>{league.displayName}</h1>
          <p>
            {league.leagueType === 'DRAFT' ? 'Draft' : 'Classic'} ·{' '}
            {scoringLabel(league.scoringType)}
            {discovery.data?.gameweek && ` · Gameweek ${discovery.data.gameweek}`}
            {discovery.data && ` · ${discovery.data.details.league_entries.length} clubs`}
          </p>
        </div>
        <div className="league-header-actions" ref={menuRef}>
          {active && (
            <button className="league-primary" onClick={() => void open()} disabled={opening.busy}>
              <Radio size={18} />
              {opening.busy ? 'Opening broadcast…' : 'Open broadcast'}
            </button>
          )}
          {league.ownerUserId === user.id && (
            <details className="league-actions-menu">
              <summary aria-label="League actions">
                <Ellipsis size={20} />
              </summary>
              <div>
                <button
                  className="delete-owned-league"
                  onClick={() => void remove()}
                  disabled={deleting.busy}
                >
                  Delete my league
                </button>
              </div>
            </details>
          )}
        </div>
      </header>
      <aside className={`league-broadcast-status ${active ? 'available' : ''}`}>
        <Radio size={14} />
        {schedules.status === 'loading' ? (
          'Checking broadcast availability…'
        ) : schedules.error ? (
          <>
            Broadcast availability unavailable. <button onClick={schedules.refresh}>Retry</button>
          </>
        ) : active ? (
          `Broadcast available until ${new Date(active.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        ) : (
          'No broadcast available now'
        )}
      </aside>
      {(opening.error || deleting.error) && (
        <p role="alert" className="discovery-error">
          {opening.error ?? deleting.error}
        </p>
      )}
      {discovery.status === 'loading' && (
        <div className="league-loading" role="status">
          Loading league data…
          <div />
          <div />
          <div />
        </div>
      )}
      {discovery.error && (
        <p role="alert" className="discovery-error">
          {discovery.error} <button onClick={discovery.refresh}>Try again</button>
        </p>
      )}
      {discovery.data && (
        <LeagueStandingsOverview
          leagueId={league.id}
          discovery={discovery.data}
          scoringType={league.scoringType}
          search={search}
          navigate={navigate}
        />
      )}
    </section>
  )
}
