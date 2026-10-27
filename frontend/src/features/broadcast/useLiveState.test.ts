import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { welcomeBroadcastState } from '../public/welcomeDemoData'
import { useLiveState } from './useLiveState'

afterEach(() => vi.unstubAllGlobals())

it('keeps streamed data when the initial request finishes late and closes the stream on exit', async () => {
  let resolveFetch: (value: Response) => void = () => undefined
  vi.stubGlobal(
    'fetch',
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve
        }),
    ),
  )
  const stream = new EventTarget()
  const close = vi.fn()
  vi.stubGlobal(
    'EventSource',
    class {
      addEventListener = stream.addEventListener.bind(stream)
      close = close
    },
  )
  const { result, unmount } = renderHook(() => useLiveState({ enabled: true, leagueId: 42 }))
  act(() =>
    stream.dispatchEvent(
      new MessageEvent('live-state', { data: JSON.stringify(welcomeBroadcastState(1)) }),
    ),
  )
  await act(async () => resolveFetch(new Response(JSON.stringify(welcomeBroadcastState(0)))))
  expect(result.current.liveState?.sequence.currentStep).toBe(2)
  act(() => stream.dispatchEvent(new Event('error')))
  expect(result.current.error).toContain('Reconnecting')
  act(() =>
    stream.dispatchEvent(
      new MessageEvent('live-state', { data: JSON.stringify(welcomeBroadcastState(2)) }),
    ),
  )
  expect(result.current.error).toBeNull()
  unmount()
  expect(close).toHaveBeenCalledOnce()
})
