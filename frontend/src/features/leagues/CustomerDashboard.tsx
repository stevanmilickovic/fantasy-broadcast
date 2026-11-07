import { useCallback, useEffect, useRef } from 'react'
import { positiveId } from '../../app/routes'
import type { Navigate } from '../../app/useBrowserNavigation'
import { useQuery } from '../../shared/api/useQuery'
import { LegalFooter } from '../../shared/ui/LegalFooter'
import { AccountDeletionPage } from '../auth/AccountDeletionPage'
import type { AuthUser } from '../auth/types'
import { LeagueCheckoutPage } from '../billing/LeagueCheckoutPage'
import { LeaguePaymentConfirmation } from '../billing/LeaguePaymentConfirmation'
import { LeagueManagementPage } from './LeagueManagementPage'
import { loadRegisteredLeagues } from './api'
import { CustomerNavigation } from './CustomerNavigation'
import { LeagueDetailPage } from './LeagueDetailPage'
import { LeaguePicker } from './LeaguePicker'
import { LeagueRegistrationPage } from './LeagueRegistrationPage'
import { useNotifications } from '../../shared/ui/notifications'

export function CustomerDashboard({
  user,
  pathname,
  search,
  onNavigate,
  onSignOut,
}: {
  user: AuthUser
  pathname: string
  search: string
  onNavigate: Navigate
  onSignOut: () => void
}) {
  const query = useQuery(`leagues:${user.id}`, loadRegisteredLeagues)
  const refreshLeagues = query.refresh
  const { notify } = useNotifications()
  const confirmed = useRef(new Set<number>())
  const leagues = query.data
  const parameters = new URLSearchParams(search)
  const paymentLeagueId = positiveId(parameters.get('fplLeagueId'))
  const confirmingPayment =
    parameters.get('payment') === 'completed' && paymentLeagueId !== undefined
  const paymentConfirmed = useCallback(
    (leagueId: number) => {
      const key = `fb:registration-confirmed:${user.id}:${leagueId}`
      if (!confirmed.current.has(leagueId)) {
        confirmed.current.add(leagueId)
        let seen = false
        try {
          seen = sessionStorage.getItem(key) === 'yes'
          sessionStorage.setItem(key, 'yes')
        } catch {
          /* Storage can be disabled; the mounted workflow still deduplicates. */
        }
        if (!seen) notify('League registered successfully.', { kind: 'success', id: key })
      }
      refreshLeagues()
      onNavigate(`/league?leagueId=${leagueId}`, true)
    },
    [refreshLeagues, onNavigate, notify, user.id],
  )
  const selectedId = positiveId(parameters.get('leagueId'))
  const selectedLeague = leagues?.find((league) => league.id === selectedId) ?? null
  useEffect(() => {
    if (!leagues) return
    if (pathname === '/leagues') {
      if (leagues.length === 0) onNavigate('/leagues/new', true)
      else if (leagues.length === 1) onNavigate(`/league?leagueId=${leagues[0].id}`, true)
    } else if ((pathname === '/league' || pathname === '/league/manage') && !selectedLeague)
      onNavigate('/leagues', true)
    else if (
      pathname === '/league/manage' &&
      selectedLeague &&
      selectedLeague.ownerUserId !== user.id &&
      user.role !== 'ADMIN'
    )
      onNavigate(`/league?leagueId=${selectedLeague.id}`, true)
  }, [leagues, pathname, selectedLeague, onNavigate, user.id, user.role])
  return (
    <main className="customer-shell">
      <CustomerNavigation
        leagues={leagues ?? []}
        selectedLeague={selectedLeague}
        user={user}
        onNavigate={onNavigate}
        onSignOut={onSignOut}
      />
      {query.error && (
        <p className="discovery-error" role="alert">
          {query.error}
        </p>
      )}
      {query.status === 'loading' && (pathname === '/leagues' || pathname === '/league') && (
        <p>Loading leagues…</p>
      )}
      {pathname === '/leagues/new' && (
        <LeagueRegistrationPage
          user={user}
          followedLeagues={leagues}
          navigate={onNavigate}
          onFollowed={query.refresh}
        />
      )}
      {pathname === '/leagues/checkout' &&
        (confirmingPayment ? (
          <LeaguePaymentConfirmation
            key={search}
            fplLeagueId={paymentLeagueId}
            leagueType={parameters.get('leagueType') === 'CLASSIC' ? 'CLASSIC' : 'DRAFT'}
            userId={user.id}
            onConfirmed={paymentConfirmed}
            onNavigate={onNavigate}
          />
        ) : (
          <LeagueCheckoutPage key={search} search={search} onNavigate={onNavigate} />
        ))}
      {pathname === '/leagues' && leagues && (
        <LeaguePicker leagues={leagues} user={user} onNavigate={onNavigate} />
      )}
      {pathname === '/league' && selectedLeague && (
        <LeagueDetailPage
          key={selectedLeague.id}
          league={selectedLeague}
          search={search}
          user={user}
          navigate={onNavigate}
          onChanged={query.refresh}
        />
      )}
      {pathname === '/league/manage' &&
        selectedLeague &&
        (selectedLeague.ownerUserId === user.id || user.role === 'ADMIN') && (
          <LeagueManagementPage
            key={selectedLeague.id}
            league={selectedLeague}
            navigate={onNavigate}
            onChanged={query.refresh}
          />
        )}
      {pathname === '/account-deletion' && <AccountDeletionPage />}
      <LegalFooter onNavigate={onNavigate} className="customer-legal-footer" />
    </main>
  )
}
