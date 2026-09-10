export type PaddleCheckout = { clientSideToken: string; priceId: string; userId: number; fplLeagueId: number; leagueType: string; plan: string; paymentSignature: string }
type PaddleApi = { Environment: { set: (environment: 'sandbox' | 'production') => void }; Initialize: (options: { token: string }) => void; Checkout: { open: (options: { items: Array<{ priceId: string; quantity: number }>; customData: Record<string, string | number> }) => void } }
declare global { interface Window { Paddle?: PaddleApi } }
let paddleLoad: Promise<PaddleApi> | null = null
const loadPaddle = () => {
  if (window.Paddle) return Promise.resolve(window.Paddle)
  if (paddleLoad) return paddleLoad
  paddleLoad = new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js'; script.async = true
    script.onload = () => window.Paddle ? resolve(window.Paddle) : reject(new Error('Paddle did not load.'))
    script.onerror = () => reject(new Error('Paddle could not be loaded.'))
    document.head.append(script)
  })
  return paddleLoad
}
export const openPaddleCheckout = async (checkout: PaddleCheckout) => {
  const paddle = await loadPaddle()
  paddle.Environment.set(checkout.clientSideToken.startsWith('test_') ? 'sandbox' : 'production')
  paddle.Initialize({ token: checkout.clientSideToken })
  paddle.Checkout.open({ items: [{ priceId: checkout.priceId, quantity: 1 }], customData: { application: 'fantasy-broadcast', user_id: checkout.userId, fpl_league_id: checkout.fplLeagueId, league_type: checkout.leagueType, plan: checkout.plan, payment_signature: checkout.paymentSignature } })
}
