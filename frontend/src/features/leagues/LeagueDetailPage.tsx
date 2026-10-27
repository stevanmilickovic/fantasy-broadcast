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
import { toLeagueDiscovery } from './leagueData'
import { LeagueStandingsOverview } from './LeagueStandingsOverview'
import type { RegisteredLeague } from './types'

export function LeagueDetailPage({
  league,
  user,
  navigate,
  onDeleted,
}: {
  league: RegisteredLeague
  user: AuthUser
  navigate: Navigate
  onDeleted: () => void
}) {
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
  const error = discovery.error ?? opening.error ?? deleting.error ?? schedules.error
  return (
    <>
      {active && (
        <aside className="customer-broadcast-access">
          <div>
            <strong>Broadcast live now</strong>
            <span>
              Available to all registered leagues until{' '}
              {new Date(active.endsAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
              .
            </span>
          </div>
          <button onClick={() => void open()} disabled={opening.busy}>
            Open broadcast
          </button>
        </aside>
      )}
      <section className="selected-league-page">
        {discovery.status === 'loading' && <p className="league-loading">Loading league data…</p>}
        {error && (
          <p role="alert" className="discovery-error">
            {error}
          </p>
        )}
        {discovery.data && (
          <LeagueStandingsOverview
            leagueId={league.id}
            discovery={discovery.data}
            scoringType={league.scoringType}
          />
        )}
        {discovery.data && league.ownerUserId === user.id && (
          <details className="league-actions-menu">
            <summary aria-label="League actions">...</summary>
            <div>
              <button
                type="button"
                className="delete-owned-league"
                onClick={() => void remove()}
                disabled={deleting.busy}
              >
                Delete my league
              </button>
            </div>
          </details>
        )}
      </section>
    </>
  )
}
