import { ArrowLeft, ArrowRight, CreditCard } from 'lucide-react'
import type { Navigate } from '../../app/useBrowserNavigation'
import { useQuery } from '../../shared/api/useQuery'
import { LegalFooter } from '../../shared/ui/LegalFooter'
import type { AuthUser } from '../auth/types'
import { CustomerNavigation } from '../leagues/CustomerNavigation'
import { billingDate, planName } from './billingFormat'
import { LeagueSubscriptionSettings } from './LeagueSubscriptionSettings'
import { loadSubscriptionOverview } from './subscriptionApi'
import type { LeagueSubscriptionOverview } from './types'

function subscriptionStatus({ status, cancelAt }: LeagueSubscriptionOverview) {
  if (status === 'canceled') return 'Canceled'
  if (status === 'past_due') return 'Payment overdue'
  if (cancelAt) return 'Renewal canceled'
  if (status === 'trialing') return 'Trial'
  return status?.replaceAll('_', ' ') ?? 'Status unavailable'
}

export function AccountSubscriptionsPage({
  leagueId,
  user,
  navigate,
  onSignOut,
}: {
  leagueId?: number
  user: AuthUser
  navigate: Navigate
  onSignOut: () => void
}) {
  const query = useQuery(`account-subscriptions:${user.id}`, loadSubscriptionOverview)
  const selected = query.data?.find((subscription) => subscription.leagueId === leagueId)

  return (
    <main className="customer-shell">
      <CustomerNavigation user={user} onNavigate={navigate} onSignOut={onSignOut} />
      <section
        className="account-subscriptions-page"
        aria-labelledby="account-subscriptions-heading"
      >
        <button
          type="button"
          className="checkout-back"
          onClick={() => navigate(leagueId ? '/account/subscriptions' : '/account')}
        >
          <ArrowLeft size={17} aria-hidden="true" />
          {leagueId ? 'All subscriptions' : 'Back to account settings'}
        </button>
        <header className="account-subscriptions-heading">
          <h1 id="account-subscriptions-heading">{selected?.leagueName ?? 'Subscriptions'}</h1>
        </header>
        {query.status === 'loading' && <p role="status">Loading subscriptions…</p>}
        {query.status === 'error' && (
          <div className="subscription-card" role="alert">
            <p>{query.error}</p>
            <button type="button" className="billing-refresh" onClick={query.refresh}>
              Try again
            </button>
          </div>
        )}
        {query.data &&
          (leagueId ? (
            selected ? (
              <LeagueSubscriptionSettings
                league={{
                  id: selected.leagueId,
                  displayName: selected.leagueName,
                  fplLeagueId: selected.fplLeagueId,
                  leagueType: selected.leagueType,
                }}
                navigate={navigate}
              />
            ) : (
              <p>This subscription is unavailable for your account.</p>
            )
          ) : query.data.length ? (
            <ul className="account-subscriptions-list">
              {query.data.map((subscription) => {
                const { leagueId, leagueName, plan, status, cancelAt, accessUntil, accessActive } =
                  subscription
                const href = `/account/subscriptions?leagueId=${leagueId}`
                return (
                  <li key={leagueId}>
                    <a
                      className="league-card account-subscription"
                      href={href}
                      onClick={(event) => {
                        if (
                          event.button !== 0 ||
                          event.ctrlKey ||
                          event.metaKey ||
                          event.shiftKey ||
                          event.altKey
                        )
                          return
                        event.preventDefault()
                        navigate(href)
                        window.scrollTo(0, 0)
                      }}
                    >
                      <span className="account-subscription-meta">
                        <span>
                          <CreditCard size={16} aria-hidden="true" /> {planName(plan)}
                        </span>
                        <span data-active={status === 'active' && accessActive && !cancelAt}>
                          {subscriptionStatus(subscription)}
                        </span>
                      </span>
                      <strong>{leagueName}</strong>
                      <small>
                        {accessActive
                          ? `Access through ${billingDate(cancelAt ?? accessUntil)}`
                          : 'Paid access inactive'}
                      </small>
                      <span className="league-card-open">
                        Manage subscription <ArrowRight size={17} aria-hidden="true" />
                      </span>
                    </a>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="subscription-card">You don’t have any league subscriptions yet.</p>
          ))}
      </section>
      <LegalFooter onNavigate={navigate} className="customer-legal-footer" />
    </main>
  )
}
