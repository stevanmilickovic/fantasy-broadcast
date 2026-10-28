import { afterEach, expect, it, vi } from 'vitest'

const pause = vi.fn()
const play = vi.fn(() => Promise.resolve())
const revokeObjectURL = vi.fn()

function mockAudio() {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('audio')))
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = () => 'blob:narration'
      static revokeObjectURL = revokeObjectURL
    },
  )
  vi.stubGlobal(
    'Audio',
    class extends EventTarget {
      preload = ''
      play = play
      pause = pause
    },
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  vi.resetModules()
})

it('stops active narration and skips queued narration when the broadcast is closed', async () => {
  mockAudio()
  const { playNarrationAudio } = await import('./broadcastSound')
  const controller = new AbortController()
  const first = playNarrationAudio('/first.mp3', controller.signal)
  const queued = playNarrationAudio('/second.mp3', controller.signal)
  await vi.waitFor(() => expect(play).toHaveBeenCalledOnce())
  controller.abort()
  await Promise.all([first, queued])
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(pause).toHaveBeenCalledOnce()
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:narration')
})

it('releases the audio URL when the browser rejects playback', async () => {
  mockAudio()
  play.mockRejectedValueOnce(new Error('Playback blocked'))
  const { playNarrationAudio } = await import('./broadcastSound')
  await playNarrationAudio('/blocked.mp3')
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:narration')
})
