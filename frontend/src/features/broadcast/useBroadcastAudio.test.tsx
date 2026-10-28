import { renderHook } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { useBroadcastAudio } from './useBroadcastAudio'
import { playNarrationAudio, playPointChangeSound } from './broadcastSound'
import { welcomeBroadcastState } from '../public/welcomeDemoData'

vi.mock('./broadcastSound', () => ({ playNarrationAudio: vi.fn(), playPointChangeSound: vi.fn() }))
beforeEach(() => vi.clearAllMocks())
it('waits for the visible event gate and never sounds a duplicate or another selected club', () => {
  const state = welcomeBroadcastState(0)
  const id = state.events[0].id
  const { rerender } = renderHook(
    ({ visible, focus }) => useBroadcastAudio(state, visible, focus),
    { initialProps: { visible: null as string | null, focus: state.matchups[0].id } },
  )
  expect(playPointChangeSound).not.toHaveBeenCalled()
  rerender({ visible: id, focus: state.matchups[1].id })
  expect(playPointChangeSound).not.toHaveBeenCalled()
  rerender({ visible: id, focus: state.matchups[0].id })
  expect(playPointChangeSound).toHaveBeenCalledTimes(1)
  rerender({ visible: null, focus: state.matchups[0].id })
  rerender({ visible: id, focus: state.matchups[0].id })
  expect(playPointChangeSound).toHaveBeenCalledTimes(1)
})
it('restarts aborted narration after Strict Mode cleanup and aborts the session on exit', () => {
  const state = welcomeBroadcastState(0)
  state.commentary[0].audioUrl = '/audio/narration'
  const { unmount } = renderHook(() => useBroadcastAudio(state, null), {
    reactStrictMode: true,
  })
  const calls = vi.mocked(playNarrationAudio).mock.calls
  expect(calls).toHaveLength(2)
  expect(calls[0][1]?.aborted).toBe(true)
  expect(calls[1][1]?.aborted).toBe(false)
  unmount()
  expect(calls[1][1]?.aborted).toBe(true)
})
