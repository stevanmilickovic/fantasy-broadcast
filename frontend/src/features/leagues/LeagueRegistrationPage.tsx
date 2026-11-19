import type { Navigate } from '../../app/useBrowserNavigation'
import { useQuery } from '../../shared/api/useQuery'
import { loadLeagueRegistrationAccess } from './api'
import { LeagueCheckoutPage } from '../billing/LeagueCheckoutPage'
import { readBillingPlan } from '../billing/billingPlans'

export function LeagueRegistrationPage({
  navigate,
  search,
}: {
  navigate: Navigate
  search: string
}) {
  const access = useQuery('registration-access', loadLeagueRegistrationAccess)
  const parameters = new URLSearchParams(search)
  if (access.data?.canRegisterLeague) {
    return (
      <LeagueCheckoutPage
        key={search}
        leagueId={parameters.get('fplLeagueId') ?? ''}
        leagueType={parameters.get('leagueType') === 'CLASSIC' ? 'CLASSIC' : 'DRAFT'}
        selectedPlan={readBillingPlan(parameters.get('plan'))}
        onNavigate={navigate}
      />
    )
  }
  return (
    <section className="customer-empty league-onboarding">
      {access.status === 'loading' ? (
        <p role="status">Checking league registration…</p>
      ) : access.error ? (
        <p role="alert">
          {access.error} <button onClick={access.refresh}>Retry</button>
        </p>
      ) : (
        <div className="register-league-card">
          <h1>League registration is closed</h1>
          <p>You can still find and follow registered leagues.</p>
        </div>
      )}
      <a
        className="league-workflow-link"
        href="/leagues/find"
        onClick={(event) => {
          if (
            event.button === 0 &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.shiftKey &&
            !event.altKey
          ) {
            event.preventDefault()
            navigate('/leagues/find')
          }
        }}
      >
        Find leagues
      </a>
    </section>
  )
}
