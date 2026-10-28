import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { welcomeBroadcastState } from '../public/welcomeDemoData'
import { loadLiveState } from './api'
import type { LiveStateResponse } from './types'
import { useLiveState } from './useLiveState'

vi.mock('./api', () => ({ loadLiveState: vi.fn() }))

let streams: TestEventSource[] = []
class TestEventSource extends EventTarget {
  close = vi.fn()
  constructor() {
    super()
    streams.push(this)
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  streams = []
  vi.stubGlobal('EventSource', TestEventSource)
  vi.mocked(loadLiveState).mockResolvedValue(welcomeBroadcastState(0))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const fullMessage =
  'This broadcast has reached its limit of 50 simultaneous viewers. Try again when a space opens.'

it('closes a full broadcast and ignores the initial snapshot arriving after rejection', async () => {
  let resolveInitial: (state: LiveStateResponse) => void = () => undefined
  vi.mocked(loadLiveState).mockReturnValue(
    new Promise((resolve) => {
      resolveInitial = resolve
    }),
  )
  const { result } = renderHook(() => useLiveState({ enabled: true, leagueId: 1 }))
  act(() => streams[0].dispatchEvent(new MessageEvent('broadcast-full', { data: fullMessage })))
  await act(async () => resolveInitial(welcomeBroadcastState(0)))
  expect(result.current.liveState).toBeNull()
  expect(result.current.error).toBe(fullMessage)
  expect(streams[0].close).toHaveBeenCalled()
  expect(vi.mocked(loadLiveState).mock.calls[0][1]?.aborted).toBe(true)
  act(() => streams[0].dispatchEvent(new Event('error')))
  expect(result.current.error).toBe(fullMessage)
})

it('clears an already loaded snapshot when full and allows an explicit retry', async () => {
  const { result } = renderHook(() => useLiveState({ enabled: true, leagueId: 1 }))
  await waitFor(() => expect(result.current.liveState).not.toBeNull())
  const oldStream = streams[0]
  act(() => oldStream.dispatchEvent(new MessageEvent('broadcast-full', { data: fullMessage })))
  expect(result.current.liveState).toBeNull()
  act(() => result.current.retry())
  await waitFor(() => expect(streams).toHaveLength(2))
  act(() =>
    streams[1].dispatchEvent(
      new MessageEvent('live-state', { data: JSON.stringify(welcomeBroadcastState(1)) }),
    ),
  )
  expect(result.current.error).toBeNull()
  expect(result.current.liveState?.sequence).toEqual(welcomeBroadcastState(1).sequence)
  act(() => oldStream.dispatchEvent(new MessageEvent('broadcast-full', { data: fullMessage })))
  expect(result.current.liveState).not.toBeNull()
})
