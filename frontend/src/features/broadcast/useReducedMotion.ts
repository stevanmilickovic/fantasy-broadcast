import { useSyncExternalStore } from 'react'

const query = () =>
  typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null
const subscribe = (notify: () => void) => {
  const preference = query()
  preference?.addEventListener('change', notify)
  return () => preference?.removeEventListener('change', notify)
}
export function useReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => query()?.matches ?? false,
    () => false,
  )
}
