import { expect, it } from 'vitest'
import { revealTransform } from './broadcastRevealGeometry'

it('fits the same element into a source slot using uniform scale and center translation', () => {
  const destination = { left: 20, top: 40, width: 100, height: 20 }
  const source = { left: 60, top: 200, width: 240, height: 60 }
  const result = revealTransform(destination, source, 4)
  expect(result).toMatchObject({ dx: 110, dy: 180, scale: 2.4 })
  const shift = (r: typeof source) => ({ ...r, left: r.left + 123, top: r.top - 400 })
  expect(revealTransform(shift(destination), shift(source), 4)).toEqual(result)
  expect(revealTransform({ ...destination, width: 0 }, source, 2)).toBeNull()
  expect(revealTransform(destination, { ...source, top: NaN }, 2)).toBeNull()
})

it('fills the emblem slot while preserving the image aspect ratio', () => {
  expect(
    revealTransform(
      { left: 20, top: 40, width: 40, height: 40 },
      { left: 0, top: 200, width: 240, height: 180 },
    ),
  ).toMatchObject({ scale: 4.5, dx: 80, dy: 230 })
})
