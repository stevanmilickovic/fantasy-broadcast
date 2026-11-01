import type { PlayerAvailability } from './types'

export type AvailabilitySeverity = 'yellow' | 'orange' | 'red'

function validChance(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100
    ? value
    : null
}

export function playerAvailability(availability?: PlayerAvailability | null) {
  const next = validChance(availability?.chanceOfPlayingNextRound)
  const current = validChance(availability?.chanceOfPlayingThisRound)
  const chance = next ?? current
  const round = next !== null ? 'next' : current !== null ? 'this' : null
  const status = availability?.status
  let severity: AvailabilitySeverity | undefined
  let label = status === 'a' ? 'Available' : 'Availability not provided'
  if (['i', 's', 'u', 'n'].includes(status ?? '') || chance === 0) {
    severity = 'red'
    label = status === 'i' ? 'Injured' : status === 's' ? 'Suspended' : 'Unavailable'
  } else if ((chance !== null && chance < 100) || status === 'd') {
    severity = chance !== null && chance <= 50 ? 'orange' : 'yellow'
    label = 'Doubtful'
  }
  return { severity, label, chance, round }
}
