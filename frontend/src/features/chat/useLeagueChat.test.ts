import { expect, test, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { mergeMessages, useLeagueChat } from './useLeagueChat'
import { loadChat } from './api'
import type { ChatMessage } from './api'

vi.mock('./api', async (original) => ({
  ...(await original<typeof import('./api')>()),
  loadChat: vi.fn(),
}))

const message = (id: string, expiresAt = '2026-11-01T12:00:00Z'): ChatMessage => ({
  id,
  leagueId: 1,
  userId: 1,
  displayName: 'Same name',
  body: id,
  createdAt: '2026-10-31T12:00:00Z',
  expiresAt,
})

test('history and retries merge in order without duplicates or expired messages', () => {
  const now = Date.parse('2026-11-01T11:00:00Z')
  const result = mergeMessages(
    [message('10'), message('12')],
    [
      message('2'),
      { ...message('10'), displayName: 'Renamed' },
      message('9', new Date(now).toISOString()),
    ],
    now,
  )
  expect(result.map((row) => row.id)).toEqual(['2', '10', '12'])
  expect(result[1].displayName).toBe('Renamed')
  expect(mergeMessages(result, [], Date.parse('2026-11-01T12:00:00Z'))).toEqual([])
})

test('an open chat removes messages at expiry without waiting for a poll', async () => {
  vi.useFakeTimers()
  const now = new Date('2026-10-31T12:00:00Z')
  vi.setSystemTime(now)
  vi.mocked(loadChat).mockResolvedValue({
    messages: [message('1', new Date(now.getTime() + 1000).toISOString())],
    hasOlder: false,
    hasMore: false,
    serverTime: now.toISOString(),
  })
  const hook = renderHook(() => useLeagueChat(1))
  try {
    await act(async () => {})
    expect(hook.result.current.messages).toHaveLength(1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1002)
    })
    expect(hook.result.current.messages).toHaveLength(0)
    expect(loadChat).toHaveBeenCalledTimes(1)
  } finally {
    hook.unmount()
    vi.useRealTimers()
  }
})
