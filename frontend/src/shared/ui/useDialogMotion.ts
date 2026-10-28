import { useCallback, useEffect, useRef, useState } from 'react'

export function useDialogMotion() {
  const dialog = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const exitAnimation = useRef<Animation | null>(null)
  const [closing, setClosing] = useState(false)
  useEffect(() => {
    const element = dialog.current
    return () => {
      exitAnimation.current?.cancel()
      element?.close()
    }
  }, [])
  const close = (afterClose?: () => void) => {
    const element = dialog.current
    if (!element?.open || exitAnimation.current) return
    const finish = () => {
      element.close()
      setOpen(false)
      setClosing(false)
      exitAnimation.current = null
      afterClose?.()
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish()
      return
    }
    setClosing(true)
    const currentStyle = window.getComputedStyle(element)
    const animation = element.animate(
      [
        { opacity: currentStyle.opacity, transform: currentStyle.transform },
        { opacity: 0, transform: 'translateY(8px)' },
      ],
      { duration: 140, easing: 'ease-in', fill: 'forwards' },
    )
    exitAnimation.current = animation
    void animation.finished
      .then(() => {
        animation.cancel()
        finish()
      })
      .catch(() => {})
  }
  const show = useCallback(() => {
    dialog.current?.showModal()
    setOpen(true)
  }, [])
  return { dialog, open, closing, close, show, onClose: () => setOpen(false) }
}
