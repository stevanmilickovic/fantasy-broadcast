import { useCallback, useState } from 'react'
import type { Navigate } from '../../app/useBrowserNavigation'
import { useMutation } from '../../shared/api/useMutation'
import { useQuery } from '../../shared/api/useQuery'
import { Pagination } from '../../shared/ui/Pagination'
import { useNotifications } from '../../shared/ui/notifications'
import type { AuthUser } from '../auth/types'
import { followLeague, loadFollowRequests, searchRegisteredLeagues } from './api'
import { LeagueSearchCard } from './LeagueSearchCard'
import type { RegisteredLeague } from './types'

export function LeagueDiscoveryPage({
  user,
  followedLeagues,
  search: routeSearch,
  navigate,
  onFollowed,
}: {
  user: AuthUser
  followedLeagues: RegisteredLeague[] | undefined
  search: string
  navigate: Navigate
  onFollowed: () => void
}) {
  const params = new URLSearchParams(routeSearch)
  const search = params.get('search') ?? ''
  const requestedPage = Number(params.get('page') ?? 0)
  const page = Number.isSafeInteger(requestedPage) && requestedPage >= 0 ? requestedPage : 0
  const [draft, setDraft] = useState({ search, value: search })
  // Synchronize URL navigation without remounting the input and losing focus on clear.
  if (draft.search !== search) setDraft({ search, value: search })
  const { notify } = useNotifications()
  const load = useCallback(
    (signal: AbortSignal) => searchRegisteredLeagues(search, page, signal),
    [search, page],
  )
  const results = useQuery(`${search}:${page}`, load)
  const following = useMutation()
  const [followActionId, setFollowActionId] = useState<number>()
  const requests = useQuery('my-requests', loadFollowRequests)
  const changePage = (nextPage: number, term = search, replace = false) => {
    const next = new URLSearchParams()
    if (term) next.set('search', term)
    if (nextPage > 0 || term) next.set('page', String(nextPage))
    navigate(`/leagues/find${next.size ? `?${next}` : ''}`, replace)
  }
  const follow = async (league: RegisteredLeague) => {
    if (league.followStatus === 'APPROVED') {
      navigate(`/league?leagueId=${league.id}`)
      return
    }
    setFollowActionId(league.id)
    const result = await following.run((signal) => followLeague(league.id, signal))
    if (!result) return
    onFollowed()
    if (result.data.status === 'PENDING') {
      requests.refresh()
      notify('Follow request sent.', { kind: 'success' })
    } else navigate(`/league?leagueId=${league.id}`)
  }
  return (
    <section className="customer-empty customer-league-discovery">
      <LeagueSearchCard
        busy={following.busy || results.status === 'loading' || !followedLeagues}
        message={results.error ?? null}
        followError={
          following.error && followActionId !== undefined
            ? { leagueId: followActionId, message: following.error }
            : undefined
        }
        loading={results.status === 'loading'}
        onRetry={results.refresh}
        user={user}
        query={draft.value}
        submittedQuery={search}
        onQueryChange={(value) => {
          setDraft({ search, value })
          if (value === '' && (search || page)) changePage(0, '', true)
        }}
        onSearch={(value) => {
          const term = value.trim()
          if (page === 0 && term === search) results.refresh()
          changePage(0, term)
        }}
        onFollow={follow}
        searchResults={(results.data?.items ?? []).map((league) => ({
          ...league,
          followStatus: followedLeagues?.some((followed) => followed.id === league.id)
            ? 'APPROVED'
            : requests.data?.find((request) => request.leagueId === league.id)?.status,
        }))}
        pagination={
          results.data && results.data.totalItems > results.data.size ? (
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
      />
    </section>
  )
}
