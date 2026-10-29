import type { BillingPlan } from './types'

export const planName = (plan: BillingPlan | null) =>
  plan === 'AI_BROADCASTER' ? 'AI Broadcaster' : 'Standard'
export const billingDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'Unavailable'

export function formatMoney(minor: number | string, currency: string) {
  const formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency })
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2
  return formatter.format(Number(minor) / 10 ** digits)
}

export function parseMoney(value: string, currency: string): number | null {
  const digits =
    new Intl.NumberFormat(undefined, { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2
  const pattern = new RegExp(`^\\d+(?:\\.\\d{1,${Math.max(1, digits)}})?$`)
  if (!pattern.test(value) || (digits === 0 && value.includes('.'))) return null
  const [whole, fraction = ''] = value.split('.')
  const minor = Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, '0'))
  return Number.isSafeInteger(minor) && minor > 0 ? minor : null
}
