import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { loadRegisteredLeagues } from '../leagues/api'
import { LeaguePaymentConfirmation } from './LeaguePaymentConfirmation'

vi.mock('../leagues/api', () => ({ loadRegisteredLeagues: vi.fn() }))
afterEach(() => vi.useRealTimers())

it('stops polling after a minute and lets the subscriber check again', async () => {
  vi.useFakeTimers()
  vi.mocked(loadRegisteredLeagues).mockResolvedValue([])
  const onConfirmed = vi.fn()
  render(
    <LeaguePaymentConfirmation
      fplLeagueId={42}
      leagueType="CLASSIC"
      userId={1}
      onConfirmed={onConfirmed}
      onNavigate={vi.fn()}
    />,
  )
  await act(async () => {})
  for (let i = 0; i < 29; i++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
  }
  expect(screen.getByRole('button', { name: 'Check again' })).toBeTruthy()
  const checks = vi.mocked(loadRegisteredLeagues).mock.calls.length
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10000)
  })
  expect(loadRegisteredLeagues).toHaveBeenCalledTimes(checks)
  expect(onConfirmed).not.toHaveBeenCalled()
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }))
  })
  expect(screen.getByRole('status').textContent).toContain('Waiting for payment confirmation')
  expect(loadRegisteredLeagues).toHaveBeenCalledTimes(checks + 1)
})

it('opens only the active purchased league owned by this subscriber and cancels polling on unmount', async () => {
  vi.useFakeTimers()
  const purchased = {
    id: 9,
    fplLeagueId: 42,
    displayName: 'Purchased league',
    leagueType: 'CLASSIC' as const,
    scoringType: 'TOTAL_POINTS' as const,
    serviceEnabled: true,
    aiNarrationEnabled: false,
    voiceNarrationEnabled: false,
    ownerUserId: 1,
  }
  vi.mocked(loadRegisteredLeagues)
    .mockClear()
    .mockResolvedValue([
      { ...purchased, id: 1, fplLeagueId: 99 },
      { ...purchased, id: 2, leagueType: 'DRAFT' },
      { ...purchased, id: 3, ownerUserId: 2 },
      { ...purchased, id: 4, serviceEnabled: false },
    ])
  const onConfirmed = vi.fn()
  const { unmount } = render(
    <LeaguePaymentConfirmation
      fplLeagueId={42}
      leagueType="CLASSIC"
      userId={1}
      onConfirmed={onConfirmed}
      onNavigate={vi.fn()}
    />,
  )
  await act(async () => {})
  expect(onConfirmed).not.toHaveBeenCalled()
  vi.mocked(loadRegisteredLeagues).mockResolvedValue([purchased])
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000)
  })
  expect(onConfirmed).toHaveBeenCalledWith(9)
  unmount()
  const checks = vi.mocked(loadRegisteredLeagues).mock.calls.length
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10000)
  })
  expect(loadRegisteredLeagues).toHaveBeenCalledTimes(checks)
})
