import type { FplLeagueType } from '../../shared/fpl/types'

export type LeaguePaymentPreview = {
  displayName: string
  managerCount: number
  registrationEligible: boolean
  validationMessage: string | null
  checkoutReady: boolean
}

export type PaddleCheckout = {
  transactionId?: string
  clientSideToken: string
  priceId: string
  userId: number
  fplLeagueId: number
  leagueType: string
  plan: string
  paymentSignature: string
}

export type BillingPlan = 'STANDARD' | 'AI_BROADCASTER'
export type Subscription = {
  linked: boolean
  subscriptionId: string | null
  plan: BillingPlan | null
  renewalPlan: BillingPlan | null
  status: string | null
  accessUntil: string | null
  cancelAt: string | null
  accessActive: boolean
  refundUntil: string | null
  awaitingConfirmation: boolean
  currencyCode: string | null
  renewalTotal: string | null
}
export type LeagueSubscriptionOverview = Pick<
  Subscription,
  'plan' | 'status' | 'accessUntil' | 'cancelAt' | 'accessActive'
> & {
  leagueId: number
  leagueName: string
  fplLeagueId: number
  leagueType: FplLeagueType
}
export type PlanPreview = {
  target: BillingPlan
  version: string
  effectiveAt: string
  chargeNow: string
  currencyCode: string
  renewalTotal: string
  immediate: boolean
}
export type AdminSubscription = {
  id: string
  leagueId: number
  leagueName: string
  ownerName: string
  plan: BillingPlan
  status: string
  periodEnd: string | null
}
export type Refund = { id: string; status: string; amount: number; reason: string }
export type Payment = {
  id: string
  currencyCode: string
  total: number
  refundable: number
  paidAt: string
  initialPurchase: boolean
  withinRefundWindow: boolean
  refunds: Refund[]
  awaitingConfirmation: boolean
}
