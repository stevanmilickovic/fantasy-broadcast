import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { welcomeBroadcastState } from '../public/welcomeDemoData'
import { useBroadcastFocus } from './useBroadcastFocus'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

it('rotates idle scenes through the leaderboard, suspends rotation for manual focus and cancels timers', () => {
  const liveState = welcomeBroadcastState(0)
  liveState.status.mode = 'COMPREHENSIVE MOCK'
  const { result, rerender, unmount } = renderHook(
    ({ selectedFocus }) => useBroadcastFocus({ liveState, selectedFocus }),
    { initialProps: { selectedFocus: 'multi' } },
  )
  expect(result.current.focusedId).toBe(liveState.matchups[0].id)
  act(() => vi.advanceTimersByTime(4000))
  expect(result.current.focusedId).toBe(liveState.matchups[1].id)
  act(() => vi.advanceTimersByTime(4000))
  expect(result.current.showingLeaderboard).toBe(true)
  act(() => result.current.dismissLeaderboard())
  rerender({ selectedFocus: liveState.matchups[0].id })
  act(() => vi.advanceTimersByTime(12_000))
  expect(result.current.showingLeaderboard).toBe(false)
  expect(result.current.focusedId).toBe(liveState.matchups[0].id)
  unmount()
  expect(vi.getTimerCount()).toBe(0)
})
