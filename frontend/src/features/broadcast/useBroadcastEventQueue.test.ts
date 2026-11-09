import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { welcomeBroadcastState } from '../public/welcomeDemoData'
import { useBroadcastEventQueue } from './useBroadcastEventQueue'

vi.mock('./broadcastSound', () => ({
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

for (const totalPoints of [false, true]) {
  it.each([6, -6])(
    `${totalPoints ? 'total-points' : 'H2H'} preserves revealed scores across older notifications without revealing future updates (delta %i)`,
    (delta) => {
      const first = welcomeBroadcastState(0)
      if (totalPoints) first.matchups = []
      const event = { ...first.events[0], id: 'first', pointDelta: 1 }
      const other = {
        ...event,
        id: 'other',
        managerId: first.teams[2].managerId,
        playerId: first.teams[2].activePlayers[0].id,
      }
      first.events = [event, other]
      first.teams[0].score = 54
      first.teams[0].activePlayers[5].points = 4
      const next = structuredClone(first)
      next.teams[0].score += delta
      next.teams[0].activePlayers[5].points += delta
      next.events = [{ ...event, id: 'newer', pointDelta: delta }]
      const future = structuredClone(next)
      future.teams[0].score += 1
      future.teams[0].activePlayers[5].points += 1
      future.events = [{ ...event, id: 'future', pointDelta: 1 }]
      for (const state of [first, next, future])
        for (const match of state.matchups)
          match.scoreline = `${match.home.score}-${match.away.score}`

      const { result, rerender } = renderHook(({ state }) => useBroadcastEventQueue(state), {
        initialProps: { state: first },
      })
      rerender({ state: next })
      expect(result.current.activeLiveState).toBe(first)
      act(() => vi.advanceTimersByTime(10_000))
      expect(result.current.latestEvent?.id).toBe('newer')
      expect(result.current.activeLiveState).toBe(next)

      rerender({ state: future })
      expect(result.current.activeLiveState).toBe(next)
      act(() => vi.advanceTimersByTime(10_000))
      expect(result.current.latestEvent?.id).toBe('other')
      expect(result.current.activeEvents).toEqual([other])
      expect(result.current.activeLiveState?.teams[0].score).toBe(54 + delta)
      expect(result.current.activeLiveState?.teams[0].activePlayers[5].points).toBe(4 + delta)
      if (!totalPoints)
        expect(result.current.activeLiveState?.matchups[0].home.score).toBe(54 + delta)
      expect(first.teams[0].score).toBe(54)

      act(() => vi.advanceTimersByTime(10_000))
      expect(result.current.latestEvent?.id).toBe('future')
      expect(result.current.activeLiveState).toBe(future)
      act(() => vi.advanceTimersByTime(10_000))
      expect(result.current.activeLiveState).toBeNull()
      expect(result.current.hasPendingNotifications).toBe(false)
    },
  )
}
