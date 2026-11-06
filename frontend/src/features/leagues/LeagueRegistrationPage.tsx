import { Pagination } from '../../shared/ui/Pagination'
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
  followedLeagues,
  navigate,
  onFollowed,
}: {
  user: AuthUser
  followedLeagues: RegisteredLeague[] | undefined
  navigate: Navigate
  onFollowed: () => void
}) {
  const access = useQuery('registration-access', loadLeagueRegistrationAccess)
  const [leagueId, setLeagueId] = useState('')
  const [leagueType, setLeagueType] = useState<FplLeagueType>('DRAFT')
  const params = new URLSearchParams(window.location.search)
  const search = params.get('search') ?? ''
  const requestedPage = Number(params.get('page') ?? 0)
  const page = Number.isSafeInteger(requestedPage) && requestedPage >= 0 ? requestedPage : 0
  const changePage = (nextPage: number, term = search) => {
    const next = new URLSearchParams({ search: term, page: String(nextPage) })
    navigate(`${window.location.pathname}?${next}`)
  }
  const loadSearch = useCallback(
    (signal: AbortSignal) => searchRegisteredLeagues(search, page, signal),
    [search, page],
  )
  const results = useQuery(`${search}:${page}`, loadSearch)
  const following = useMutation()
  const requests = useQuery('my-requests', loadFollowRequests)
  const follow = async (league: RegisteredLeague) => {
    if (league.followStatus === 'APPROVED') {
      navigate(`/league?leagueId=${league.id}`)
      return
    }
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
      key={search}
      canRegisterLeague={access.data.canRegisterLeague}
      leagueId={leagueId}
      leagueType={leagueType}
      busy={following.busy || results.status === 'loading' || !followedLeagues}
      registrationMessage={null}
      searchMessage={following.error ?? results.error ?? null}
      searchResults={(results.data?.items ?? []).map((league) => ({
        ...league,
        followStatus: followedLeagues?.some((followed) => followed.id === league.id)
          ? 'APPROVED'
          : requests.data?.find((request) => request.leagueId === league.id)?.status,
      }))}
      pagination={
        results.data ? (
          <Pagination
            page={page}
            totalItems={results.data.totalItems}
            size={results.data.size}
            label="Registered league pages"
            busy={following.busy}
            onPageChange={changePage}
          />
        ) : null
      }
      loading={results.status === 'loading'}
      onRetry={() => {
        following.reset()
        results.refresh()
      }}
      user={user}
      onLeagueIdChange={setLeagueId}
      onLeagueTypeChange={setLeagueType}
      onSubmit={(event) => {
        event.preventDefault()
        navigate(`/leagues/checkout?${new URLSearchParams({ fplLeagueId: leagueId, leagueType })}`)
      }}
      onSearch={(query) => {
        if (page === 0 && query.trim() === search) results.refresh()
        changePage(0, query.trim())
      }}
      onFollow={follow}
    />
  )
}
