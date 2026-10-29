import { describe, expect, it } from 'vitest'
import { parseMoney } from './billingFormat'

describe('refund amounts', () => {
  it('accepts exact minor units for the payment currency', () => {
    expect(parseMoney('5.25', 'EUR')).toBe(525)
    expect(parseMoney('500', 'JPY')).toBe(500)
    expect(parseMoney('1.250', 'KWD')).toBe(1250)
  })
  it('rejects rounding, zero, negatives and ambiguous input', () => {
    for (const value of ['0', '-2', '5.001', '1e3', '1,20', 'NaN', '9007199254740992'])
      expect(parseMoney(value, 'EUR')).toBeNull()
    expect(parseMoney('5.5', 'JPY')).toBeNull()
  })
})
