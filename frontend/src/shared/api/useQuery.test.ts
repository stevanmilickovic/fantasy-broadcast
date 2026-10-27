import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useQuery } from './useQuery'

it('discards late responses after switching resources and aborts on unmount', async () => {
  let resolveFirst: (value: string) => void = () => undefined
  const first = vi.fn((signal: AbortSignal) => {
    expect(signal.aborted).toBe(false)
    return new Promise<string>((resolve) => {
      resolveFirst = resolve
    })
  })
  const second = vi.fn((signal: AbortSignal) => {
    expect(signal.aborted).toBe(false)
    return Promise.resolve('second league')
  })
  const { result, rerender, unmount } = renderHook(({ id, load }) => useQuery(id, load), {
    initialProps: { id: 'first', load: first },
  })
  rerender({ id: 'second', load: second })
  await waitFor(() => expect(result.current.data).toBe('second league'))
  await act(async () => resolveFirst('stale first league'))
  expect(result.current.data).toBe('second league')
  expect(first.mock.calls[0][0].aborted).toBe(true)
  unmount()
  expect(second.mock.calls[0][0].aborted).toBe(true)
})
