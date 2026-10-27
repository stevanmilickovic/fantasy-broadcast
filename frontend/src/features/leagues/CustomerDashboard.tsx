import { useEffect } from 'react'
import { positiveId } from '../../app/routes'
import type { Navigate } from '../../app/useBrowserNavigation'
import { useQuery } from '../../shared/api/useQuery'
import { LegalFooter } from '../../shared/ui/LegalFooter'
import { AccountDeletionPage } from '../auth/AccountDeletionPage'
import type { AuthUser } from '../auth/types'
import { LeagueCheckoutPage } from '../billing/LeagueCheckoutPage'
import { loadRegisteredLeagues } from './api'
import { CustomerNavigation } from './CustomerNavigation'
import { LeagueDetailPage } from './LeagueDetailPage'
import { LeaguePicker } from './LeaguePicker'
import { LeagueRegistrationPage } from './LeagueRegistrationPage'

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
  const leagues = query.data
  const selectedId = positiveId(new URLSearchParams(search).get('leagueId'))
  const selectedLeague = leagues?.find((league) => league.id === selectedId) ?? null
  useEffect(() => {
    if (!leagues) return
    if (pathname === '/leagues') {
      if (leagues.length === 0) onNavigate('/leagues/new', true)
      else if (leagues.length === 1) onNavigate(`/league?leagueId=${leagues[0].id}`, true)
    } else if (pathname === '/league' && !selectedLeague) onNavigate('/leagues', true)
  }, [leagues, pathname, selectedLeague, onNavigate])
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
        <LeagueRegistrationPage user={user} navigate={onNavigate} onFollowed={query.refresh} />
      )}
      {pathname === '/leagues/checkout' && (
        <LeagueCheckoutPage key={search} search={search} onNavigate={onNavigate} />
      )}
      {pathname === '/leagues' && leagues && (
        <LeaguePicker leagues={leagues} user={user} onNavigate={onNavigate} />
      )}
      {pathname === '/league' && selectedLeague && (
        <LeagueDetailPage
          key={selectedLeague.id}
          league={selectedLeague}
          user={user}
          navigate={onNavigate}
          onDeleted={query.refresh}
        />
      )}
      {pathname === '/account-deletion' && <AccountDeletionPage />}
      <LegalFooter onNavigate={onNavigate} className="customer-legal-footer" />
    </main>
  )
}
