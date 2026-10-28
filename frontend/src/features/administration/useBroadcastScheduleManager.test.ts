import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { loadBroadcastSchedules } from './api'
import { useBroadcastScheduleManager } from './useBroadcastScheduleManager'

vi.mock('./api', () => ({
  loadBroadcastSchedules: vi.fn(),
  deleteBroadcastSchedule: vi.fn(),
  generateTodayBroadcastSchedules: vi.fn(),
  saveBroadcastSchedule: vi.fn(),
}))
afterEach(() => vi.useRealTimers())

it('removes completed rows from an open list while retaining future schedules and cleaning its timer', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-28T12:00:00Z'))
  vi.mocked(loadBroadcastSchedules).mockResolvedValue([
    { id: 1, startsAt: '2026-10-28T11:00:00Z', endsAt: '2026-10-28T12:00:01Z' },
    { id: 2, startsAt: '2026-10-28T13:00:00Z', endsAt: '2026-10-28T14:00:00Z' },
  ])
  const { result, unmount } = renderHook(useBroadcastScheduleManager)
  await act(async () => {
    await Promise.resolve()
  })
  expect(result.current.schedules.map((schedule) => schedule.id)).toEqual([1, 2])
  act(() => {
    vi.advanceTimersByTime(30_000)
  })
  expect(result.current.schedules.map((schedule) => schedule.id)).toEqual([2])
  unmount()
  expect(vi.getTimerCount()).toBe(0)
})
