import { useEffect, useRef } from 'react'

export function useDismissibleMenus() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return
      ref.current?.querySelectorAll<HTMLDetailsElement>('details[open]').forEach((menu) => {
        if (event instanceof KeyboardEvent || !menu.contains(event.target as Node)) {
          menu.open = false
          if (event instanceof KeyboardEvent) menu.querySelector('summary')?.focus()
        }
      })
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [])
  return ref
}
