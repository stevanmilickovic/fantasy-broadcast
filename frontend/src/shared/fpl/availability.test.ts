import { expect, it } from 'vitest'
import { playerAvailability } from './availability'
import type { PlayerAvailability } from './types'

const available: PlayerAvailability = {
  status: 'a',
  chanceOfPlayingThisRound: null,
  chanceOfPlayingNextRound: null,
  news: '',
}

it('leaves healthy players with blank probabilities unflagged without inventing 100%', () => {
  expect(playerAvailability(available)).toMatchObject({
    severity: undefined,
    label: 'Available',
    chance: null,
  })
  expect(playerAvailability()).toMatchObject({ severity: undefined, chance: null })
  expect(
    playerAvailability({ ...available, chanceOfPlayingNextRound: 100 }).severity,
  ).toBeUndefined()
})

it('colors the published playing chance and prioritizes unavailable statuses', () => {
  for (const [chance, severity] of [
    [75, 'yellow'],
    [50, 'orange'],
    [25, 'orange'],
    [0, 'red'],
  ] as const)
    expect(
      playerAvailability({ ...available, status: 'd', chanceOfPlayingNextRound: chance }),
    ).toMatchObject({ severity, chance, round: 'next' })
  for (const status of ['i', 's', 'u', 'n'])
    expect(playerAvailability({ ...available, status }).severity).toBe('red')
  expect(playerAvailability({ ...available, status: 'd' })).toMatchObject({
    severity: 'yellow',
    chance: null,
  })
})

it('uses this round only when next round is absent and ignores invalid probabilities', () => {
  expect(
    playerAvailability({
      ...available,
      chanceOfPlayingThisRound: 75,
      chanceOfPlayingNextRound: 50,
    }),
  ).toMatchObject({ chance: 50, round: 'next' })
  expect(playerAvailability({ ...available, chanceOfPlayingThisRound: 75 })).toMatchObject({
    chance: 75,
    round: 'this',
  })
  for (const chance of [-1, 101, 75.5, NaN])
    expect(playerAvailability({ ...available, chanceOfPlayingNextRound: chance }).chance).toBeNull()
})
