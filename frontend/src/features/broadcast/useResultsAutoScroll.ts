import { useEffect, useRef } from 'react'
import { useReducedMotion } from './useReducedMotion'

const SCROLL_SPEED = 32 // pixels per second
const END_PAUSE = 2500
const INTERACTION_PAUSE = 6000

export function useResultsAutoScroll() {
  const track = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    const element = track.current
    if (!element || reducedMotion) return
    let direction = 1
    let lastTime = performance.now()
    let resumeAt = lastTime + END_PAUSE
    let hovering = false
    let dragging = false
    let position = element.scrollLeft
    let frame = 0

    const pause = () => {
      resumeAt = performance.now() + INTERACTION_PAUSE
      position = element.scrollLeft
    }
    const enter = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') hovering = true
    }
    const leave = () => {
      hovering = false
      pause()
    }
    const down = () => {
      dragging = true
      pause()
    }
    const up = () => {
      if (!dragging) return
      dragging = false
      pause()
    }
    const tick = (now: number) => {
      const elapsed = Math.min(now - lastTime, 50)
      lastTime = now
      const end = element.scrollWidth - element.clientWidth
      if (
        end > 0 &&
        now >= resumeAt &&
        !document.hidden &&
        !hovering &&
        !dragging &&
        !element.contains(document.activeElement)
      ) {
        position = Math.max(
          0,
          Math.min(end, position + (direction * SCROLL_SPEED * elapsed) / 1000),
        )
        element.scrollLeft = position
        if (
          (direction === 1 && element.scrollLeft >= end - 1) ||
          (direction === -1 && element.scrollLeft <= 1)
        ) {
          direction *= -1
          resumeAt = now + END_PAUSE
        }
      } else position = element.scrollLeft
      frame = requestAnimationFrame(tick)
    }
    element.addEventListener('pointerenter', enter)
    element.addEventListener('pointerleave', leave)
    element.addEventListener('pointerdown', down)
    element.addEventListener('wheel', pause, { passive: true })
    element.addEventListener('focusout', pause)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      element.removeEventListener('pointerenter', enter)
      element.removeEventListener('pointerleave', leave)
      element.removeEventListener('pointerdown', down)
      element.removeEventListener('wheel', pause)
      element.removeEventListener('focusout', pause)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [reducedMotion])

  return track
}
