import { useState } from 'react'
import type { Navigate } from '../../app/useBrowserNavigation'
import { useQuery } from '../../shared/api/useQuery'
import type { FplLeagueType } from '../../shared/fpl/types'
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
  const [leagueId, setLeagueId] = useState('')
  const [leagueType, setLeagueType] = useState<FplLeagueType>('DRAFT')
  return (
    <section className="customer-empty league-onboarding">
      {access.status === 'loading' ? (
        <p role="status">Checking league registration?</p>
      ) : access.error ? (
        <p role="alert">
          {access.error} <button onClick={access.refresh}>Retry</button>
        </p>
      ) : access.data?.canRegisterLeague ? (
        <LeagueRegistrationForm
          leagueId={leagueId}
          leagueType={leagueType}
          onLeagueIdChange={setLeagueId}
          onLeagueTypeChange={setLeagueType}
          onSubmit={(event) => {
            event.preventDefault()
            const params = new URLSearchParams({ fplLeagueId: leagueId, leagueType })
            const plan = new URLSearchParams(search).get('plan')
            if (plan === 'STANDARD' || plan === 'AI_BROADCASTER') params.set('plan', plan)
            navigate(`/leagues/checkout?${params}`)
          }}
        />
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
