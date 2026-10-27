import { useCallback, useState } from 'react'
import { useMutation } from '../../shared/api/useMutation'
import { useQuery } from '../../shared/api/useQuery'
import type { FplLeagueType } from '../../shared/fpl/types'
import { registerLeague } from '../leagues/api'
import { loadAdminLeagues, updateAdminLeague } from './api'
import type { AdminLeague } from './types'

export function useAdminLeagueRegistry() {
  const [edits, setEdits] = useState<Record<number, Partial<AdminLeague>>>({})
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [leagueId, setLeagueId] = useState('')
  const [leagueType, setLeagueType] = useState<FplLeagueType>('DRAFT')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [notice, setMessage] = useState<string | null>(null)
  const mutation = useMutation()
  const busy = mutation.busy
  const message = mutation.error ?? notice
  const load = useCallback(
    (signal: AbortSignal) => loadAdminLeagues(page, pageSize, search, signal),
    [page, pageSize, search],
  )
  const query = useQuery(page + ':' + pageSize + ':' + search, load)
  const leagues = (query.data?.items ?? []).map((league) => ({ ...league, ...edits[league.id] }))
  const totalItems = query.data?.totalItems ?? 0
  const refresh = (requestedPage = page) => {
    setPage(requestedPage)
    query.refresh()
  }
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const result = await mutation.run((signal) => registerLeague(leagueId, leagueType, signal))
    if (!result) return

    setPage(0)
    await refresh(0)
    setLeagueId('')
    setMessage('League registered.')
  }
  const save = async (league: AdminLeague) => {
    const result = await mutation.run((signal) => updateAdminLeague(league, signal))
    if (!result) return

    setEdits((current) => {
      const next = { ...current }
      delete next[league.id]
      return next
    })
    await refresh()
    setMessage(`Saved settings for ${league.displayName}.`)
  }
  const updateLeagueFlag = (
    leagueId: number,
    changes: Partial<
      Pick<AdminLeague, 'serviceEnabled' | 'aiNarrationEnabled' | 'voiceNarrationEnabled'>
    >,
  ) => setEdits((current) => ({ ...current, [leagueId]: { ...current[leagueId], ...changes } }))
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  return {
    page,
    setPage,
    pageSize,
    setPageSize,
    leagueId,
    setLeagueId,
    leagueType,
    setLeagueType,
    searchInput,
    setSearchInput,
    search,
    setSearch,
    message,
    busy,
    query,
    leagues,
    totalItems,
    submit,
    save,
    updateLeagueFlag,
    totalPages,
  }
}
