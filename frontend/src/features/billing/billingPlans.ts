import type { BillingPlan } from './types'

export const monthlyPlanPrice: Record<BillingPlan, string> = {
  STANDARD: '€6.99',
  AI_BROADCASTER: '€19.99',
}

export function readBillingPlan(value: string | null): BillingPlan | null {
  return value === 'STANDARD' || value === 'AI_BROADCASTER' ? value : null
}
