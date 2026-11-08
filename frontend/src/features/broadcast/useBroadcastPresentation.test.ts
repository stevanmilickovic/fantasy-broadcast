import { act, renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { welcomeBroadcastState } from '../public/welcomeDemoData'
import { useBroadcastPresentation } from './useBroadcastPresentation'

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
    onTransitionStateChange: vi.fn(),
  }
}
it('opens the initial notification gate only after actual reveal completion', () => {
  const input = options()
  const { result } = renderHook(() => useBroadcastPresentation(input))
  expect(result.current.phase).toBe('preparing')
  expect(result.current.visibleEventId).toBeNull()
  act(() => result.current.settled(result.current.transitionId))
  expect(result.current.phase).toBe('idle')
  expect(result.current.visibleEventId).toBe(input.latestEventId)
})
it('keeps outgoing data until covered, freezes the captured target, and rejects obsolete completions', () => {
  const first = options()
  const { result, rerender } = renderHook(useBroadcastPresentation, { initialProps: first })
  act(() => result.current.settled(result.current.transitionId))
  const next = options(1)
  if (first.liveState && next.liveState) {
    first.liveState.teams[0].activePlayers[0].fixtureProgress = 'LIVE'
    next.liveState.teams[0].activePlayers[0].fixtureProgress = 'COMPLETE'
  }
  rerender(next)
  expect(result.current.phase).toBe('covering')
  expect(result.current.holdingPendingUpdates).toBe(false)
  expect(result.current.liveState).toBe(first.liveState)
  expect(result.current.liveState?.teams[0].activePlayers[0].fixtureProgress).toBe('LIVE')
  const id = result.current.transitionId
  act(() => result.current.covered(id - 1))
  expect(result.current.liveState).toBe(first.liveState)
  act(() => result.current.covered(id))
  expect(result.current.liveState).toBe(next.liveState)
  expect(result.current.liveState?.teams[0].activePlayers[0].fixtureProgress).toBe('COMPLETE')
  const latest = options(3)
  rerender(latest)
  expect(result.current.liveState).toBe(next.liveState)
  act(() => result.current.settled(id))
  expect(result.current.liveState).toBe(latest.liveState)
})
it('does not leak scores before queue activation and allows manual interruption in either mode', () => {
  for (const isTotalPointsBroadcast of [false, true]) {
    const first = options()
    if (isTotalPointsBroadcast && first.liveState) first.liveState.matchups = []
    const { result, rerender, unmount } = renderHook(useBroadcastPresentation, {
      initialProps: first,
    })
    act(() => result.current.settled(result.current.transitionId))
    const next = options(1)
    if (isTotalPointsBroadcast && next.liveState) next.liveState.matchups = []
    rerender({ ...next, activeLiveState: null, hasPendingNotifications: true })
    expect(result.current.liveState).toBe(first.liveState)
    rerender(next)
    const id = result.current.transitionId
    rerender({ ...next, selectedFocus: next.focusedId ?? 'multi' })
    expect(result.current.phase).toBe('idle')
    expect(result.current.liveState).toBe(next.liveState)
    act(() => {
      result.current.covered(id)
      result.current.settled(id)
    })
    expect(result.current.phase).toBe('idle')
    unmount()
  }
})
it('commits the correct leaderboard and can settle a cover directly after resize', () => {
  const first = options()
  const { result, rerender } = renderHook(useBroadcastPresentation, { initialProps: first })
  act(() => result.current.settled(result.current.transitionId))
  rerender({ ...first, showingLeaderboard: true })
  expect(result.current.displayingLeaderboard).toBe(false)
  act(() => result.current.settled(result.current.transitionId))
  expect(result.current.displayingLeaderboard).toBe(true)
  expect(result.current.phase).toBe('idle')
})

it('captures only the active group events rather than other events from its server snapshot', () => {
  const input = options()
  const selected = input.liveState?.events[0]
  if (!input.liveState || !selected) throw new Error('Missing fixture')
  input.liveState.events.push({ ...selected, id: 'queued-elsewhere', managerId: 'another-club' })
  const activeEvents = [selected]
  const { result } = renderHook(() => useBroadcastPresentation({ ...input, activeEvents }))
  expect(result.current.liveState?.events).toEqual([selected])
})

it('does not subtract a historical event again during idle rotation', () => {
  const first = options()
  const { result, rerender } = renderHook(useBroadcastPresentation, { initialProps: first })
  act(() => result.current.settled(result.current.transitionId))
  rerender({ ...first, activeLiveState: null, latestEventId: undefined })
  expect(result.current.liveState?.events).toEqual([])
  rerender({ ...first, activeLiveState: null, latestEventId: undefined, focusedId: 'match-two' })
  act(() => result.current.covered(result.current.transitionId))
  expect(result.current.liveState?.events).toEqual([])
  expect(result.current.liveState?.matchups[1].scoreline).toBe(
    first.liveState?.matchups[1].scoreline,
  )
  act(() => result.current.settled(result.current.transitionId))
  expect(result.current.visibleEventId).toBeNull()
})
