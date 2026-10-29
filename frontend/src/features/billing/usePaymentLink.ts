import { useEffect, useState } from 'react'
import { errorMessage } from '../../shared/api/http'
import { initializePaddle, isPaddleInitialized, onPaddleEvent } from './paddleCheckout'

type LinkState =
  | { status: 'loading' | 'ready' | 'opened' | 'closed' | 'completed' }
  | { status: 'error'; error: string }

export function usePaymentLink(clientSideToken: string) {
  const [state, setState] = useState<LinkState>({ status: 'loading' })
  useEffect(() => {
    // Paddle reads _ptxn at initialization. A return through SPA history needs a fresh document.
    if (isPaddleInitialized()) {
      window.location.reload()
      return
    }
    const controller = new AbortController()
    let closeCheckout: (() => void) | undefined
    const unsubscribe = onPaddleEvent((event) => {
      if (event.name === 'checkout.loaded')
        setState((previous) => (previous.status === 'completed' ? previous : { status: 'opened' }))
      else if (event.name === 'checkout.completed') setState({ status: 'completed' })
      else if (event.name === 'checkout.closed')
        setState((previous) => (previous.status === 'completed' ? previous : { status: 'closed' }))
      else if (event.name === 'checkout.error')
        setState((previous) =>
          previous.status === 'completed'
            ? previous
            : {
                status: 'error',
                error:
                  'This checkout could not be opened. Reload this payment link or contact support if the problem continues.',
              },
        )
    })
    // Paddle reads _ptxn itself. Calling Checkout.open here could override payment-update flows.
    void initializePaddle(clientSideToken, controller.signal)
      .then((paddle) => {
        if (controller.signal.aborted) {
          paddle.Checkout.close()
          return
        }
        closeCheckout = () => paddle.Checkout.close()
        setState((previous) => (previous.status === 'loading' ? { status: 'ready' } : previous))
      })
      .catch((error) => {
        if (!controller.signal.aborted) setState({ status: 'error', error: errorMessage(error) })
      })
    return () => {
      controller.abort()
      unsubscribe()
      closeCheckout?.()
    }
  }, [clientSideToken])
  return state
}
