import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { welcomeBroadcastState } from '../public/welcomeDemoData'
import { useBroadcastPresentation } from './useBroadcastPresentation'

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function options(frame = 0): Parameters<typeof useBroadcastPresentation>[0] {
  const liveState = welcomeBroadcastState(frame)
  return {
    liveState,
    activeLiveState: liveState,
    hasPendingNotifications: false,
    focusedId: liveState.matchups[frame % 2].id,
    selectedFocus: 'multi',
    latestEventId: liveState.events[0].id,
    showingLeaderboard: false,
    isTotalPointsBroadcast: false,
    isBroadcastRoute: true,
    onTransitionStateChange: vi.fn(),
  }
}

it('holds notifications until the initial scene reveal finishes', () => {
  const input = options()
  const { result, unmount } = renderHook(() => useBroadcastPresentation(input))
  expect(result.current.visibleEventId).toBeNull()
  expect(result.current.holdingPendingUpdates).toBe(true)
  act(() => vi.advanceTimersByTime(16))
  expect(result.current.revealingMatch).toBe(true)
  act(() => vi.advanceTimersByTime(1884))
  expect(result.current.revealingMatch).toBe(false)
  expect(result.current.visibleEventId).toBe(input.latestEventId)
  unmount()
  expect(vi.getTimerCount()).toBe(0)
})

it('freezes the outgoing snapshot until the wipe midpoint and reveals events after the new scene', () => {
  const first = options()
  const { result, rerender, unmount } = renderHook(useBroadcastPresentation, {
    initialProps: first,
  })
  act(() => vi.advanceTimersByTime(1900))
  const next = options(1)
  rerender(next)
  expect(result.current.transitioningToMatch).toBe(true)
  expect(result.current.liveState).toBe(first.liveState)
  expect(result.current.visibleEventId).toBeNull()
  act(() => vi.advanceTimersByTime(800))
  expect(result.current.liveState).toBe(next.liveState)
  expect(result.current.displayedFocusId).toBe(next.focusedId)
  act(() => vi.advanceTimersByTime(800))
  expect(result.current.transitioningToMatch).toBe(false)
  expect(result.current.revealingMatch).toBe(true)
  act(() => vi.advanceTimersByTime(1100))
  expect(result.current.visibleEventId).toBe(next.latestEventId)
  unmount()
  expect(vi.getTimerCount()).toBe(0)
})

it('keeps scores frozen while the next event group waits to start', () => {
  const first = options()
  const { result, rerender } = renderHook(useBroadcastPresentation, { initialProps: first })
  act(() => vi.advanceTimersByTime(1900))
  const next = options(1)
  rerender({ ...next, activeLiveState: null, hasPendingNotifications: true })
  expect(result.current.liveState).toBe(first.liveState)
  rerender(next)
  act(() => vi.advanceTimersByTime(800))
  expect(result.current.liveState).toBe(next.liveState)
})

it('changes manually selected head-to-head scenes without a wipe', () => {
  const first = options()
  const { result, rerender } = renderHook(useBroadcastPresentation, { initialProps: first })
  act(() => vi.advanceTimersByTime(1900))
  const next = options(1)
  rerender({ ...next, selectedFocus: next.focusedId ?? 'multi' })
  expect(result.current.liveState).toBe(next.liveState)
  expect(result.current.transitioningToMatch).toBe(false)
  expect(result.current.revealingMatch).toBe(false)
})

it('applies an update received during the wipe after the reveal finishes', () => {
  const { result, rerender } = renderHook(useBroadcastPresentation, { initialProps: options() })
  act(() => vi.advanceTimersByTime(1900))
  const next = options(1)
  rerender(next)
  act(() => vi.advanceTimersByTime(800))
  const latest = options(3)
  rerender(latest)
  expect(result.current.liveState).toBe(next.liveState)
  act(() => vi.advanceTimersByTime(1900))
  expect(result.current.liveState).toBe(latest.liveState)
  expect(result.current.visibleEventId).toBe(latest.latestEventId)
})

it('swaps to the leaderboard at the wipe midpoint and returns to the focused scene', () => {
  const initial = options()
  const { result, rerender, unmount } = renderHook(useBroadcastPresentation, {
    initialProps: initial,
  })
  act(() => vi.advanceTimersByTime(1900))
  rerender({ ...initial, showingLeaderboard: true })
  expect(result.current.displayingLeaderboard).toBe(false)
  act(() => vi.advanceTimersByTime(800))
  expect(result.current.displayingLeaderboard).toBe(true)
  act(() => vi.advanceTimersByTime(1900))
  rerender(initial)
  act(() => vi.advanceTimersByTime(800))
  expect(result.current.displayingLeaderboard).toBe(false)
  unmount()
  expect(vi.getTimerCount()).toBe(0)
})
