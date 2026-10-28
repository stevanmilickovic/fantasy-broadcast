import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { welcomeBroadcastState } from '../public/welcomeDemoData'
import { usePlayerNotification } from './usePlayerNotification'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

function advance(milliseconds: number) {
  act(() => vi.advanceTimersByTime(milliseconds))
}

it('holds pending points, then counts the combined event delta and retains all labels during exit', () => {
  const event = welcomeBroadcastState(0).events[0]
  const events = [
    { ...event, pointDelta: 2 },
    { ...event, id: 'deduction', pointDelta: -5 },
  ]
  const { result, rerender, unmount } = renderHook(
    ({ active, pending }) => usePlayerNotification(7, active ? events : [], pending),
    { initialProps: { active: false, pending: -3 } },
  )
  expect(result.current.pointsToRender).toBe(10)
  rerender({ active: true, pending: 0 })
  expect(result.current.pointsToRender).toBe(10)
  expect(result.current.notificationEventId).toBeNull()
  advance(240)
  expect(result.current.notificationEventId).toBe(event.id)
  for (let step = 0; step < 3; step += 1) advance(120)
  expect(result.current.pointsToRender).toBe(7)
  rerender({ active: false, pending: 0 })
  expect(result.current.notificationLeaving).toBe(true)
  expect(result.current.activeEvents).toEqual(events)
  advance(200)
  expect(result.current.activeEvents).toEqual([])
  unmount()
  expect(vi.getTimerCount()).toBe(0)
})

it('cancels an old count when another notification arrives and cleans up on unmount', () => {
  const first = { ...welcomeBroadcastState(0).events[0], pointDelta: 2 }
  const { result, rerender, unmount } = renderHook(
    ({ points, event }) => usePlayerNotification(points, [event], 0),
    { initialProps: { points: 5, event: first } },
  )
  advance(240)
  advance(180)
  expect(result.current.pointsToRender).toBe(4)
  rerender({ points: 3, event: { ...first, id: 'next', pointDelta: -2 } })
  expect(result.current.pointsToRender).toBe(5)
  expect(result.current.notificationEventId).toBeNull()
  advance(240)
  advance(180)
  advance(180)
  expect(result.current.pointsToRender).toBe(3)
  unmount()
  expect(vi.getTimerCount()).toBe(0)
})

it('bounds the duration of a large correction and lands exactly on the supplied total', () => {
  const event = { ...welcomeBroadcastState(0).events[0], pointDelta: -1000 }
  const { result, unmount } = renderHook(() => usePlayerNotification(-950, [event], 0))
  expect(result.current.pointsToRender).toBe(50)
  advance(240)
  for (let step = 0; step < 5; step++) advance(70)
  expect(result.current.pointsToRender).toBe(-950)
  unmount()
})

it('reduced motion shows final values and removes expired event labels immediately', () => {
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
  const event = welcomeBroadcastState(0).events[0]
  const { result, rerender, unmount } = renderHook(
    ({ events }) => usePlayerNotification(8, events, 0),
    { initialProps: { events: [event] } },
  )
  expect(result.current.pointsToRender).toBe(8)
  expect(result.current.notificationEventId).toBe(event.id)
  rerender({ events: [] })
  expect(result.current.notificationEventId).toBeNull()
  expect(result.current.activeEvents).toEqual([])
  unmount()
  vi.unstubAllGlobals()
})
