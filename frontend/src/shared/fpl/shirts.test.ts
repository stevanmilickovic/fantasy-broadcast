import { expect, it } from 'vitest'
import { shirtCodeFor, shirtUrlFor } from './shirts'

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

it('uses the cached club code for goalkeeper variants and keeps regular kits for outfield players', () => {
  expect(shirtUrlFor(3, 'GKP')).toContain('/shirt_3_1-110.png')
  for (const position of ['DEF', 'MID', 'FWD'])
    expect(shirtUrlFor(3, position)).toContain('/shirt_3-110.png')
  expect(shirtUrlFor(3, 'GKP', 66)).toContain('/shirt_3_1-66.png')
  expect(shirtUrlFor(undefined, 'GKP')).toBeUndefined()
})
