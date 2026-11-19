import type { Navigate } from '../../app/useBrowserNavigation'
import { useQuery } from '../../shared/api/useQuery'
import { loadLeagueRegistrationAccess } from './api'
import { LeagueRegistrationForm } from './LeagueRegistrationForm'

export function LeagueRegistrationPage({
  navigate,
  search,
}: {
  navigate: Navigate
  search: string
}) {
  const access = useQuery('registration-access', loadLeagueRegistrationAccess)
  return (
    <section className="customer-empty league-onboarding">
      {access.status === 'loading' ? (
        <p role="status">Checking league registration…</p>
      ) : access.error ? (
        <p role="alert">
          {access.error} <button onClick={access.refresh}>Retry</button>
        </p>
      ) : access.data?.canRegisterLeague ? (
        <LeagueRegistrationForm key={search} search={search} navigate={navigate} />
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
