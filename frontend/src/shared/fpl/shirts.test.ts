import { expect, it } from 'vitest'
import { shirtCodeFor } from './shirts'

it('resolves full names and FPL aliases consistently without matching unknown clubs', () => {
  const shirts = [
    { name: 'Manchester City', shortName: 'MCI', code: 43 },
    { name: 'Newcastle United', shortName: 'NEW', code: 4 },
  ]
  expect(shirtCodeFor('Man City', shirts)).toBe(43)
  expect(shirtCodeFor('MCI', shirts)).toBe(43)
  expect(shirtCodeFor('Newcastle', shirts)).toBe(4)
  expect(shirtCodeFor('Unknown', shirts)).toBeUndefined()
})
