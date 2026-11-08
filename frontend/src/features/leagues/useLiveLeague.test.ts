import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useLiveLeague } from './useLiveLeague'

const projection = {
  source: 'DRAFT',
  gameweek: 10,
  managerScores: { '1': 42 },
  matchups: [],
  standings: [],
  pointsFetchedAt: '2026-11-08T12:00:00Z',
  fixturesFetchedAt: '2026-11-08T12:00:00Z',
}
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
function transport() {
  vi.useFakeTimers()
  const streams: Array<EventTarget & { close: ReturnType<typeof vi.fn> }> = []
  vi.stubGlobal(
    'EventSource',
    class extends EventTarget {
      close = vi.fn()
      constructor() {
        super()
        streams.push(this)
      }
    },
  )
  const fetch = vi.fn(async () => new Response(JSON.stringify(projection)))
  vi.stubGlobal('fetch', fetch)
  return { streams, fetch }
}
const send = (stream: EventTarget, name: string, data: unknown = '') =>
  act(() => stream.dispatchEvent(new MessageEvent(name, { data: JSON.stringify(data) })))

it('uses shared broadcast updates, retains stale data on failure, and resumes ten-second polling when stopped', async () => {
  const { streams, fetch } = transport()
  const { result, unmount } = renderHook(() => useLiveLeague(4, true))
  send(streams[0], 'league-live', projection)
  await act(() => vi.advanceTimersByTimeAsync(30_000))
  expect(fetch).not.toHaveBeenCalled()
  expect(result.current.data?.managerScores['1']).toBe(42)
  send(streams[0], 'broadcast-error')
  expect(result.current.error).toContain('last received')
  await act(() => vi.advanceTimersByTimeAsync(10_000))
  expect(fetch).not.toHaveBeenCalled()
  send(streams[0], 'league-live', { ...projection, managerScores: { '1': 48 } })
  expect(result.current.data?.managerScores['1']).toBe(48)
  expect(result.current.error).toBeUndefined()
  send(streams[0], 'broadcast-stopped')
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(fetch).toHaveBeenCalledTimes(1)
  await act(() => vi.advanceTimersByTimeAsync(10_000))
  expect(fetch).toHaveBeenCalledTimes(2)
  unmount()
  expect(streams[0].close).toHaveBeenCalledOnce()
  send(streams[0], 'league-live', projection)
  await act(() => vi.advanceTimersByTimeAsync(30_000))
  expect(fetch).toHaveBeenCalledTimes(2)
})

it('falls back on connection loss and clears data and the stream on access denial', async () => {
  const { streams, fetch } = transport()
  const { result, unmount } = renderHook(() => useLiveLeague(4, true))
  send(streams[0], 'league-live', projection)
  fetch.mockResolvedValueOnce(new Response('{}', { status: 404 }))
  send(streams[0], 'error')
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(result.current.data).toBeUndefined()
  expect(streams[0].close).toHaveBeenCalledOnce()
  send(streams[0], 'league-live', projection)
  expect(result.current.data).toBeUndefined()
  await act(() => vi.advanceTimersByTimeAsync(30_000))
  expect(fetch).toHaveBeenCalledTimes(1)
  unmount()
})

it('keeps the cached API interval when a broadcast cannot supply complete league data', async () => {
  const { streams, fetch } = transport()
  const { unmount } = renderHook(() => useLiveLeague(4, true))
  send(streams[0], 'league-live', { ...projection, scoresUnavailableReason: 'Incomplete lineups.' })
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(fetch).toHaveBeenCalledTimes(1)
  await act(() => vi.advanceTimersByTimeAsync(10_000))
  expect(fetch).toHaveBeenCalledTimes(2)
  unmount()
})
