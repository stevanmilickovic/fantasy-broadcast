import { afterEach, expect, it, vi } from 'vitest'
import { HttpError, request, requestJson } from './http'

afterEach(() => vi.unstubAllGlobals())
it('lets the browser set the multipart boundary for image uploads', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetch)
  const body = new FormData()
  body.append('image', new Blob(['png'], { type: 'image/png' }), 'team.png')
  await request('/api/test', { method: 'PUT', body })
  expect(fetch.mock.calls[0][1].body).toBe(body)
  expect(fetch.mock.calls[0][1].headers.has('Content-Type')).toBe(false)
})
it('preserves structured server errors and handles non-JSON failures', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'League unavailable' }), { status: 409 }),
    )
    .mockResolvedValueOnce(new Response('Unavailable', { status: 503 }))
  vi.stubGlobal('fetch', fetch)
  await expect(request('/api/test')).rejects.toMatchObject({
    status: 409,
    message: 'League unavailable',
  })
  await expect(request('/api/test')).rejects.toBeInstanceOf(HttpError)
})
it('passes cancellation through and does not attach JSON headers to GET requests', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('{"id":42}'))
  vi.stubGlobal('fetch', fetch)
  const signal = new AbortController().signal
  expect(await requestJson('/api/test', { signal })).toEqual({ id: 42 })
  const options = fetch.mock.calls[0][1]
  expect(options.signal).toBe(signal)
  expect(options.headers.has('Content-Type')).toBe(false)
})
