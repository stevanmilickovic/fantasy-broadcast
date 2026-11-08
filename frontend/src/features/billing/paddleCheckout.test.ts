import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PaddleCheckout } from './types'
import type { PaddleEvent } from './paddleCheckout'

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
  it('rejects invalid tokens before loading or initializing checkout', async () => {
    const initialize = vi.fn()
    window.Paddle = {
      Environment: { set: vi.fn() },
      Initialize: initialize,
      Checkout: { open: vi.fn(), close: vi.fn() },
    }
    const { initializePaddle } = await import('./paddleCheckout')
    for (const token of ['', 'invalid', 'test_', 'live_'])
      await expect(initializePaddle(token)).rejects.toThrow('Payment settings are invalid')
    expect(initialize).not.toHaveBeenCalled()
  })

  it('initializes once when a customer closes checkout and opens it again', async () => {
    let emit: ((event: { name: string }) => void) | undefined
    const sdk = {
      Environment: { set: vi.fn() },
      Initialize: vi.fn((options: { eventCallback?: (event: PaddleEvent) => void }) => {
        emit = options.eventCallback
      }),
      Checkout: { open: vi.fn(), close: vi.fn() },
    }
    window.Paddle = sdk
    const { openPaddleCheckout } = await import('./paddleCheckout')
    const first = openPaddleCheckout(checkout)
    await vi.waitFor(() => expect(sdk.Checkout.open).toHaveBeenCalledTimes(1))
    emit?.({ name: 'checkout.closed' })
    await expect(first).resolves.toEqual({ status: 'closed' })
    const second = openPaddleCheckout(checkout)
    await vi.waitFor(() => expect(sdk.Checkout.open).toHaveBeenCalledTimes(2))
    emit?.({ name: 'checkout.closed' })
    await second
    expect(sdk.Initialize).toHaveBeenCalledTimes(1)
    expect(sdk.Environment.set).toHaveBeenCalledWith('sandbox')
    expect(sdk.Checkout.open).toHaveBeenCalledTimes(2)
  })

  it('closes an abandoned purchase without letting late cleanup close a newer checkout', async () => {
    let emit: ((event: { name: string; data?: { transaction_id?: string } }) => void) | undefined
    const close = vi.fn(() => emit?.({ name: 'checkout.closed' }))
    const open = vi.fn()
    window.Paddle = {
      Environment: { set: vi.fn() },
      Initialize: (options) => {
        emit = options.eventCallback
      },
      Checkout: { open, close },
    }
    const { openPaddleCheckout } = await import('./paddleCheckout')
    const old = new AbortController()
    const first = openPaddleCheckout(checkout, old.signal)
    await vi.waitFor(() => expect(open).toHaveBeenCalledTimes(1))
    old.abort()
    await expect(first).rejects.toMatchObject({ name: 'AbortError' })
    const next = new AbortController()
    const second = openPaddleCheckout({ ...checkout, transactionId: 'txn_next' }, next.signal)
    await vi.waitFor(() => expect(open).toHaveBeenCalledTimes(2))
    old.abort()
    emit?.({ name: 'checkout.closed', data: { transaction_id: 'txn_test' } })
    expect(close).toHaveBeenCalledTimes(1)
    emit?.({ name: 'checkout.closed', data: { transaction_id: 'txn_next' } })
    await expect(second).resolves.toEqual({ status: 'closed' })
  })

  it('completes once even when programmatic close immediately emits closed', async () => {
    let emit: ((event: { name: string }) => void) | undefined
    const close = vi.fn(() => emit?.({ name: 'checkout.closed' }))
    const open = vi.fn()
    window.Paddle = {
      Environment: { set: vi.fn() },
      Initialize: (options) => {
        emit = options.eventCallback
      },
      Checkout: { open, close },
    }
    const { openPaddleCheckout } = await import('./paddleCheckout')
    const complete = openPaddleCheckout(checkout)
    await vi.waitFor(() => expect(open).toHaveBeenCalledTimes(1))
    emit?.({ name: 'checkout.completed' })
    emit?.({ name: 'checkout.completed' })
    await expect(complete).resolves.toEqual({
      status: 'completed',
      successPath: '/leagues/checkout?fplLeagueId=100&leagueType=DRAFT&payment=completed',
    })
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('cleans up an opening error and permits retry and browser-back dismissal', async () => {
    let emit: ((event: { name: string }) => void) | undefined
    const close = vi.fn()
    const open = vi.fn()
    window.Paddle = {
      Environment: { set: vi.fn() },
      Initialize: (options) => {
        emit = options.eventCallback
      },
      Checkout: { open, close },
    }
    const { openPaddleCheckout } = await import('./paddleCheckout')
    const first = openPaddleCheckout(checkout)
    await vi.waitFor(() => expect(open).toHaveBeenCalledTimes(1))
    emit?.({ name: 'checkout.error' })
    await expect(first).rejects.toThrow('could not be opened')
    const second = openPaddleCheckout(checkout)
    await vi.waitFor(() => expect(open).toHaveBeenCalledTimes(2))
    window.dispatchEvent(new PopStateEvent('popstate'))
    await expect(second).resolves.toEqual({ status: 'closed' })
    expect(close).toHaveBeenCalledTimes(2)
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
