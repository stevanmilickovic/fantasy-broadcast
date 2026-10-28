type Rect = { left: number; top: number; width: number; height: number }

export function revealTransform(destination: Rect, source: Rect, preferredScale: number) {
  const values = [...Object.values(destination), ...Object.values(source), preferredScale]
  if (
    values.some((value) => !Number.isFinite(value)) ||
    destination.width <= 0 ||
    destination.height <= 0 ||
    source.width <= 0 ||
    source.height <= 0 ||
    preferredScale <= 0
  )
    return null
  const dx = source.left + source.width / 2 - destination.left - destination.width / 2
  const dy = source.top + source.height / 2 - destination.top - destination.height / 2
  const scale = Math.min(
    preferredScale,
    source.width / destination.width,
    source.height / destination.height,
  )
  return { dx, dy, scale, from: `translate(${dx}px, ${dy}px) scale(${scale})` }
}

export const BROADCAST_MOTION = {
  cover: 480,
  titleHold: 360,
  hold: 360,
  flight: 780,
  backdrop: 450,
}
export const REVEAL_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'
