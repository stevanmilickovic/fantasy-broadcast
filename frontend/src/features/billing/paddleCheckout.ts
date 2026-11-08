import type { PaddleCheckout } from './types'
export type PaddleEvent = { name: string; data?: { transaction_id?: string } }
export type PurchaseOutcome = { status: 'closed' } | { status: 'completed'; successPath: string }
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

let cancelPurchase: (() => void) | null = null
export const openPaddleCheckout = async (
  checkout: PaddleCheckout,
  signal?: AbortSignal,
  onOpened?: () => void,
): Promise<PurchaseOutcome> => {
  const transactionId = checkout.transactionId
  if (!transactionId) throw new Error('A payment reference is required. Please refresh checkout.')
  const paddle = await initializePaddle(checkout.clientSideToken, signal)
  signal?.throwIfAborted()
  const successPath = `/leagues/checkout?${new URLSearchParams({
    fplLeagueId: String(checkout.fplLeagueId),
    leagueType: checkout.leagueType,
    payment: 'completed',
  })}`
  cancelPurchase?.()
  return new Promise<PurchaseOutcome>((resolve, reject) => {
    let settled = false
    const cleanup = () => {
      unsubscribe()
      signal?.removeEventListener('abort', abort)
      window.removeEventListener('popstate', cancel)
      if (cancelPurchase === cancel) cancelPurchase = null
    }
    const finish = (outcome: PurchaseOutcome, close: boolean) => {
      if (settled) return
      settled = true
      cleanup()
      if (close) paddle.Checkout.close()
      resolve(outcome)
    }
    const cancel = () => finish({ status: 'closed' }, true)
    const abort = () => {
      if (settled) return
      settled = true
      cleanup()
      paddle.Checkout.close()
      reject(signal?.reason ?? new DOMException('Checkout abandoned', 'AbortError'))
    }
    const unsubscribe = onPaddleEvent((event) => {
      if (event.data?.transaction_id && event.data.transaction_id !== transactionId) return
      if (event.name === 'checkout.loaded') onOpened?.()
      else if (event.name === 'checkout.completed')
        finish({ status: 'completed', successPath }, true)
      else if (event.name === 'checkout.closed') finish({ status: 'closed' }, false)
      else if (event.name === 'checkout.error') {
        if (settled) return
        settled = true
        cleanup()
        paddle.Checkout.close()
        reject(new Error('Secure checkout could not be opened. Please try again.'))
      }
    })
    signal?.addEventListener('abort', abort, { once: true })
    window.addEventListener('popstate', cancel)
    cancelPurchase = cancel
    try {
      paddle.Checkout.open({
        transactionId,
        settings: { successUrl: `${window.location.origin}${successPath}` },
      })
    } catch (error) {
      settled = true
      cleanup()
      reject(error)
    }
  })
}
