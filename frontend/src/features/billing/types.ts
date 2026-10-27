export type LeaguePaymentPreview = {
  displayName: string
  managerCount: number
  registrationEligible: boolean
  validationMessage: string | null
  checkoutReady: boolean
}

export type PaddleCheckout = {
  clientSideToken: string
  priceId: string
  userId: number
  fplLeagueId: number
  leagueType: string
  plan: string
  paymentSignature: string
}
