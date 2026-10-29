import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PaddleCheckout } from './types'

const checkout: PaddleCheckout = {
  transactionId: 'txn_test',
  clientSideToken: 'test_token',
  priceId: 'pri_standard',
  userId: 1,
  fplLeagueId: 100,
  leagueType: 'DRAFT',
  plan: 'STANDARD',
  paymentSignature: 'signature',
}

beforeEach(() => vi.resetModules())
afterEach(() => {
  delete window.Paddle
})

describe('Paddle SDK lifecycle', () => {
  it('initializes once when a customer closes checkout and opens it again', async () => {
    const sdk = {
      Environment: { set: vi.fn() },
      Initialize: vi.fn(),
      Checkout: { open: vi.fn(), close: vi.fn() },
    }
    window.Paddle = sdk
    const { openPaddleCheckout } = await import('./paddleCheckout')
    await openPaddleCheckout(checkout)
    await openPaddleCheckout(checkout)
    expect(sdk.Initialize).toHaveBeenCalledTimes(1)
    expect(sdk.Environment.set).toHaveBeenCalledWith('sandbox')
    expect(sdk.Checkout.open).toHaveBeenCalledTimes(2)
  })

  it('does not open an abandoned link after its page unmounts during loading', async () => {
    const sdk = {
      Environment: { set: vi.fn() },
      Initialize: vi.fn(),
      Checkout: { open: vi.fn(), close: vi.fn() },
    }
    window.Paddle = sdk
    const { initializePaddle } = await import('./paddleCheckout')
    const controller = new AbortController()
    const loading = initializePaddle('test_token', controller.signal)
    controller.abort()
    await expect(loading).rejects.toMatchObject({ name: 'AbortError' })
    expect(sdk.Initialize).not.toHaveBeenCalled()
    await initializePaddle('test_token')
    expect(sdk.Initialize).toHaveBeenCalledTimes(1)
  })

  it('removes event subscriptions and uses production for live client tokens', async () => {
    let emit: ((event: { name: string }) => void) | undefined
    window.Paddle = {
      Environment: { set: vi.fn() },
      Initialize: (options) => {
        emit = options.eventCallback
      },
      Checkout: { open: vi.fn(), close: vi.fn() },
    }
    const { initializePaddle, onPaddleEvent } = await import('./paddleCheckout')
    const listener = vi.fn()
    const unsubscribe = onPaddleEvent(listener)
    await initializePaddle('live_token')
    expect(window.Paddle.Environment.set).toHaveBeenCalledWith('production')
    emit?.({ name: 'checkout.loaded' })
    unsubscribe()
    emit?.({ name: 'checkout.closed' })
    expect(listener).toHaveBeenCalledTimes(1)
    await expect(initializePaddle('test_other')).rejects.toThrow('Payment settings changed')
  })
})
