import { useCallback, useState } from 'react'
import type { Navigate } from '../../app/useBrowserNavigation'
import { useMutation } from '../../shared/api/useMutation'
import { useQuery } from '../../shared/api/useQuery'
import type { FplLeagueType } from '../../shared/fpl/types'
import type { AuthUser } from '../auth/types'
import {
  followLeague,
  loadFollowRequests,
  loadLeagueRegistrationAccess,
  searchRegisteredLeagues,
} from './api'
import { LeagueRegistrationForm } from './LeagueRegistrationForm'
import type { RegisteredLeague } from './types'

export function LeagueRegistrationPage({
  user,
  navigate,
  onFollowed,
}: {
  user: AuthUser
  navigate: Navigate
  onFollowed: () => void
}) {
  const access = useQuery('registration-access', loadLeagueRegistrationAccess)
  const [leagueId, setLeagueId] = useState('')
  const [leagueType, setLeagueType] = useState<FplLeagueType>('DRAFT')
  const [search, setSearch] = useState('')
  const loadSearch = useCallback(
    (signal: AbortSignal) =>
      search ? searchRegisteredLeagues(search, signal) : Promise.resolve([]),
    [search],
  )
  const results = useQuery(search, loadSearch)
  const following = useMutation()
  const requests = useQuery('my-requests', loadFollowRequests)
  const follow = async (league: RegisteredLeague) => {
    const result = await following.run((signal) => followLeague(league.id, signal))
    if (result) {
      onFollowed()
      if (result.data.status === 'PENDING') {
        requests.refresh()
      } else navigate(`/league?leagueId=${league.id}`)
    }
  }
  if (access.status === 'loading') return <p>Checking league registration…</p>
  if (access.status === 'error')
    return (
      <p role="alert" className="discovery-error">
        {access.error}
      </p>
    )
  return (
    <LeagueRegistrationForm
      canRegisterLeague={access.data.canRegisterLeague}
      leagueId={leagueId}
      leagueType={leagueType}
      busy={following.busy || results.status === 'loading'}
      registrationMessage={null}
      searchMessage={following.error ?? results.error ?? null}
      searchResults={(results.data ?? []).map((league) => ({
        ...league,
        followStatus: requests.data?.find((request) => request.leagueId === league.id)?.status,
      }))}
      user={user}
      onLeagueIdChange={setLeagueId}
      onLeagueTypeChange={setLeagueType}
      onSubmit={(event) => {
        event.preventDefault()
        navigate(`/leagues/checkout?${new URLSearchParams({ fplLeagueId: leagueId, leagueType })}`)
      }}
      onSearch={(query) => {
        if (query.trim() === search) results.refresh()
        else setSearch(query.trim())
      }}
      onFollow={follow}
    />
  )
}
