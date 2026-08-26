let audioContext: AudioContext | undefined

function getAudioContext() {
  if (audioContext) return audioContext
  const AudioContextConstructor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  audioContext = new AudioContextConstructor()
  return audioContext
}

// Must be called directly from a click/tap. Browsers otherwise reject later sound started by SSE updates.
export const enablePointChangeSound = () => {
  try {
    const context = getAudioContext()
    if (context.state === 'suspended') void context.resume()
  } catch {
    // Audio is optional; unsupported browsers simply remain silent.
  }
}

export const playPointChangeSound = (pointDelta: number) => {
  try {
    const context = getAudioContext()
    if (context.state !== 'running') return
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(pointDelta >= 0 ? 880 : 440, context.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(pointDelta >= 0 ? 1320 : 280, context.currentTime + 0.16)
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.2)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.21)
  } catch {
    // Audio is optional.
  }
}

let narrationChain = Promise.resolve()

export const playNarrationAudio = (audioUrl: string) => {
  narrationChain = narrationChain
    .catch(() => undefined)
    .then(() => new Promise<void>((resolve) => {
      const audio = new Audio(audioUrl)
      audio.preload = 'auto'
      audio.addEventListener('ended', () => resolve(), { once: true })
      audio.addEventListener('error', () => resolve(), { once: true })
      void audio.play().catch(() => resolve())
    }))
  return narrationChain
}
