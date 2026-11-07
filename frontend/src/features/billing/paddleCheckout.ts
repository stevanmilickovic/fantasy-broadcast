import type { PaddleCheckout } from './types'
export type PaddleEvent = { name: string }
type PaddleEventListener = (event: PaddleEvent) => void
type PaddleApi = {
  Environment: { set: (environment: 'sandbox' | 'production') => void }
  Initialize: (options: { token: string; eventCallback?: PaddleEventListener }) => void
  Checkout: {
    open: (options: { transactionId: string; settings: { successUrl: string } }) => void
    close: () => void
  }
}
declare global {
  interface Window {
    Paddle?: PaddleApi
  }
}
let paddleLoad: Promise<PaddleApi> | null = null
let initializedToken: string | null = null
const listeners = new Set<PaddleEventListener>()

export function isPaddleInitialized() {
  return initializedToken !== null
}

export function onPaddleEvent(listener: PaddleEventListener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const loadPaddle = () => {
  if (window.Paddle) return Promise.resolve(window.Paddle)
  if (paddleLoad) return paddleLoad
  paddleLoad = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js'
    script.async = true
    const failed = () => {
      window.clearTimeout(timeout)
      paddleLoad = null
      script.remove()
      reject(new Error('Secure checkout could not be loaded. Please reload the page to try again.'))
    }
    const timeout = window.setTimeout(failed, 20_000)
    script.onload = () => {
      window.clearTimeout(timeout)
      if (window.Paddle) resolve(window.Paddle)
      else failed()
    }
    script.onerror = failed
    document.head.append(script)
  })
  return paddleLoad
}

export async function initializePaddle(clientSideToken: string, signal?: AbortSignal) {
  if (!/^(test|live)_.+/.test(clientSideToken))
    throw new Error('Payment settings are invalid. Please contact support.')
  const paddle = await loadPaddle()
  signal?.throwIfAborted()
  if (initializedToken !== null && initializedToken !== clientSideToken)
    throw new Error('Payment settings changed. Please reload this page.')
  if (initializedToken === null) {
    paddle.Environment.set(clientSideToken.startsWith('test_') ? 'sandbox' : 'production')
    paddle.Initialize({
      token: clientSideToken,
      eventCallback: (event) => {
        for (const listener of listeners) listener(event)
      },
    })
    initializedToken = clientSideToken
  }
  return paddle
}

let stopPurchaseEvents: (() => void) | null = null
export const openPaddleCheckout = async (checkout: PaddleCheckout, signal?: AbortSignal) => {
  if (!checkout.transactionId)
    throw new Error('A payment reference is required. Please refresh checkout.')
  const paddle = await initializePaddle(checkout.clientSideToken, signal)
  signal?.throwIfAborted()
  const successPath = `/leagues/checkout?${new URLSearchParams({
    fplLeagueId: String(checkout.fplLeagueId),
    leagueType: checkout.leagueType,
    payment: 'completed',
  })}`
  stopPurchaseEvents?.()
  stopPurchaseEvents = onPaddleEvent((event) => {
    if (event.name === 'checkout.completed') {
      stopPurchaseEvents?.()
      stopPurchaseEvents = null
      paddle.Checkout.close()
      window.location.assign(successPath)
    } else if (event.name === 'checkout.closed') {
      stopPurchaseEvents?.()
      stopPurchaseEvents = null
    }
  })
  paddle.Checkout.open({
    transactionId: checkout.transactionId,
    settings: { successUrl: `${window.location.origin}${successPath}` },
  })
}
