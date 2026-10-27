import { useEffect } from 'react'

export function useScreenWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return

    let wakeLock: WakeLockSentinel | null = null
    let isCancelled = false

    const requestWakeLock = async () => {
      if (document.visibilityState !== 'visible' || wakeLock) return
      try {
        const requestedWakeLock = await navigator.wakeLock.request('screen')
        if (isCancelled) {
          await requestedWakeLock.release()
          return
        }
        wakeLock = requestedWakeLock
        requestedWakeLock.addEventListener('release', () => {
          if (wakeLock === requestedWakeLock) wakeLock = null
        })
      } catch {
        // Wake lock support is optional and requests can be denied by the browser or OS.
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void requestWakeLock()
    }

    void requestWakeLock()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      isCancelled = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      void wakeLock?.release()
      wakeLock = null
    }
  }, [enabled])
}
