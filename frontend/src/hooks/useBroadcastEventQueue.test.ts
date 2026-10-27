import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { welcomeBroadcastState } from '../components/customer/welcomeDemoData'
import { useBroadcastEventQueue } from './useBroadcastEventQueue'

vi.mock('../utils/broadcastSound', () => ({
  playPointChangeSound: vi.fn(),
  playNarrationAudio: vi.fn(),
}))

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

it('holds incoming events during transitions and never replays duplicate events', () => {
  const state = welcomeBroadcastState(0)
  const { result, rerender, unmount } = renderHook(
    ({ defer }) => useBroadcastEventQueue(state, defer),
    { initialProps: { defer: true } },
  )
  expect(result.current.activeEvents).toEqual([])
  expect(result.current.hasPendingNotifications).toBe(true)
  rerender({ defer: false })
  expect(result.current.latestEvent?.id).toBe(state.events[0].id)
  act(() => vi.advanceTimersByTime(10_000))
  expect(result.current.activeEvents).toEqual([])
  rerender({ defer: false })
  expect(result.current.hasPendingNotifications).toBe(false)
  unmount()
  expect(vi.getTimerCount()).toBe(0)
})

it('preserves the active score snapshot while another matchup waits', () => {
  const first = welcomeBroadcastState(0)
  const second = welcomeBroadcastState(1)
  const { result, rerender } = renderHook(({ state }) => useBroadcastEventQueue(state), {
    initialProps: { state: first },
  })
  rerender({ state: second })
  expect(result.current.activeLiveState).toBe(first)
  expect(result.current.hasPendingNotifications).toBe(true)
  act(() => vi.advanceTimersByTime(10_000))
  expect(result.current.activeLiveState).toBe(second)
})
