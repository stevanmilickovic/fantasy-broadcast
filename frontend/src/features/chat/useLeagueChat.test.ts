import { expect, test } from 'vitest'
import { mergeMessages } from './useLeagueChat'
import type { ChatMessage } from './api'

const message = (id: string, expiresAt = '2026-11-01T12:00:00Z'): ChatMessage => ({
  id,
  leagueId: 1,
  userId: 1,
  displayName: 'Same name',
  email: 'one@example.com',
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
