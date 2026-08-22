export const playPointChangeSound = (pointDelta: number) => {
  try {
    const AudioContextConstructor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    const context = new AudioContextConstructor()
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
    oscillator.onended = () => void context.close()
  } catch {
    // Audio can be blocked until the browser has received a user interaction.
  }
}
