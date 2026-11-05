import { useLayoutEffect, useRef } from 'react'
import {
  BROADCAST_MOTION as timing,
  REVEAL_EASING,
  revealTransform,
} from './broadcastRevealGeometry'
import type { BroadcastScenePresentation } from './sceneTypes'

function measureInFrame<T>(element: HTMLElement, read: () => T): T {
  const tiltedFrame = element.closest<HTMLElement>('[data-broadcast-tilt]')
  const previousTransform = tiltedFrame?.style.transform ?? ''
  if (tiltedFrame) tiltedFrame.style.transform = 'none'
  try {
    return read()
  } finally {
    if (tiltedFrame) tiltedFrame.style.transform = previousTransform
  }
}

export function useSceneTransition(presentation: BroadcastScenePresentation) {
  const root = useRef<HTMLDivElement>(null)
  const { phase, transitionId: id, covered, settled } = presentation
  useLayoutEffect(() => {
    const element = root.current
    if (!element || phase === 'idle') return
    const stage = element.querySelector<HTMLElement>('.broadcast-scene')
    const wipe = element.querySelector<HTMLElement>('.broadcast-wipe')
    const backdrop = element.querySelector<HTMLElement>('.broadcast-intro-backdrop')
    if (!stage || !wipe || !backdrop) return
    const setMotion = (value?: string) => {
      if (value) {
        element.dataset.motion = value
        stage.dataset.motion = value
      } else {
        delete element.dataset.motion
        delete stage.dataset.motion
      }
    }
    const pieces = [...wipe.querySelectorAll<HTMLElement>('i')]
    const travel = measureInFrame(element, () => {
      const frame = wipe.getBoundingClientRect()
      const edges = pieces.map((piece) => piece.getBoundingClientRect())
      return {
        left: Math.max(frame.width, ...edges.map((edge) => edge.right - frame.left)) + 2,
        right: Math.max(frame.width, ...edges.map((edge) => frame.right - edge.left)) + 2,
      }
    })
    let valid = true
    const effects: Animation[] = []
    const animate = (node: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions) => {
      const effect = node.animate(frames, { fill: 'both', ...options })
      effects.push(effect)
      // Every effect is tracked, including paused ones canceled before being awaited.
      void effect.finished.catch(() => {})
      return effect
    }
    const clear = () => effects.forEach((effect) => effect.cancel())
    const finish = () => {
      if (!valid) return
      valid = false
      // Hide covers before canceling their fill effects restores the base CSS.
      setMotion('settled')
      clear()
      settled(id)
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') finish()
    }
    const bounds = element.getBoundingClientRect()
    const cells = [...element.querySelectorAll<HTMLElement>('[data-reveal-cell]')].map((cell) => ({
      cell,
      width: cell.offsetWidth,
      height: cell.offsetHeight,
    }))
    const observer = new ResizeObserver(() => {
      const next = element.getBoundingClientRect()
      if (
        Math.abs(bounds.width - next.width) > 1 ||
        Math.abs(bounds.height - next.height) > 1 ||
        cells.some(
          ({ cell, width, height }) =>
            Math.abs(cell.offsetWidth - width) > 1 || Math.abs(cell.offsetHeight - height) > 1,
        )
      )
        finish()
    })
    observer.observe(element)
    element
      .querySelectorAll<HTMLElement>('[data-reveal-cell]')
      .forEach((cell) => observer.observe(cell))
    reduced.addEventListener('change', finish)
    window.addEventListener('orientationchange', finish)
    document.addEventListener('visibilitychange', onVisibility)
    document.fonts?.addEventListener('loadingdone', finish)
    async function run() {
      if (!element || !stage || !wipe || !backdrop) return
      if (reduced.matches || !element.animate) {
        finish()
        return
      }
      const moveWipe = (covering: boolean) => {
        const core = animate(
          wipe,
          [
            { transform: covering ? `translateX(-${travel.left}px)` : 'translateX(0)' },
            { transform: covering ? 'translateX(0)' : `translateX(${travel.right}px)` },
          ],
          { duration: timing.cover, easing: REVEAL_EASING },
        )
        const layers = pieces.map((piece, index) =>
          animate(
            piece,
            [
              { translate: covering ? `${-35 - index * 20}% 0` : '0 0' },
              { translate: covering ? '0 0' : `${25 + index * 30}% 0` },
            ],
            { duration: timing.cover * [1.15, 0.8, 1.35][index], easing: REVEAL_EASING },
          ),
        )
        return Promise.all([core, ...layers].map((effect) => effect.finished))
      }
      if (phase === 'covering') {
        await moveWipe(true)
        if (valid) covered(id)
        return
      }
      const nodes = [...element.querySelectorAll<HTMLElement>('[data-reveal-role]')]
      const measurements = measureInFrame(element, () =>
        nodes.map((node) => {
          const slot = element.querySelector<HTMLElement>(
            `[data-intro-slot="${node.dataset.revealRole}"]`,
          )
          const font = Number.parseFloat(getComputedStyle(node).fontSize)
          const preferred = Number.parseFloat(
            getComputedStyle(stage).getPropertyValue(
              node.dataset.revealRole === 'score' ? '--intro-score-size' : '--intro-name-size',
            ),
          )
          return {
            node,
            geometry: slot
              ? revealTransform(
                  node.getBoundingClientRect(),
                  slot.getBoundingClientRect(),
                  node.dataset.revealRole?.endsWith('-emblem') ? undefined : preferred / font,
                )
              : null,
          }
        }),
      )
      if (!measurements.length || measurements.some(({ geometry }) => !geometry)) {
        finish()
        return
      }
      const flights = measurements.map(({ node, geometry }) => {
        if (!geometry) throw new Error('Missing reveal geometry')
        const flight = animate(
          node,
          [
            {
              transform: geometry.from,
              opacity: node.dataset.revealRole?.endsWith('-emblem') ? 0.65 : 1,
            },
            { transform: 'translate(0px, 0px) scale(1)', opacity: getComputedStyle(node).opacity },
          ],
          { duration: timing.flight, easing: REVEAL_EASING },
        )
        flight.pause()
        flight.currentTime = 0
        return flight
      })
      setMotion('introducing')
      await animate(wipe, [{ transform: 'translateX(0)' }, { transform: 'translateX(0)' }], {
        duration: timing.titleHold,
      }).finished
      if (!valid) return
      await moveWipe(false)
      if (!valid) return
      await animate(backdrop, [{ opacity: 1 }, { opacity: 1 }], { duration: timing.hold }).finished
      if (!valid) return
      setMotion('landing')
      const fade = animate(backdrop, [{ opacity: 1 }, { opacity: 0 }], {
        duration: timing.backdrop,
      })
      flights.forEach((flight) => flight.play())
      await Promise.all([...flights, fade].map((effect) => effect.finished))
      finish()
    }
    void run().catch(() => {
      if (valid) finish()
    })
    return () => {
      valid = false
      clear()
      setMotion()
      observer.disconnect()
      reduced.removeEventListener('change', finish)
      window.removeEventListener('orientationchange', finish)
      document.removeEventListener('visibilitychange', onVisibility)
      document.fonts?.removeEventListener('loadingdone', finish)
    }
  }, [phase, id, covered, settled])
  return root
}
