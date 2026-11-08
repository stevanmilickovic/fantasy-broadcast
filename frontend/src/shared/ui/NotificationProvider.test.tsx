import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NotificationProvider } from './NotificationProvider'
import { useNotifications } from './notifications'

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
function Controls() {
  const { notify } = useNotifications()
  return (
    <>
      <button onClick={() => notify('Saved.', { kind: 'success' })}>Save</button>
      <button onClick={() => notify('Try again.', { kind: 'error' })}>Fail</button>
    </>
  )
}
it('deduplicates pending notices, pauses expiry and retains errors until dismissed', () => {
  vi.useFakeTimers()
  const { unmount } = render(
    <NotificationProvider>
      <Controls />
    </NotificationProvider>,
  )
  fireEvent.click(screen.getByText('Save'))
  fireEvent.click(screen.getByText('Save'))
  expect(screen.getAllByRole('status')).toHaveLength(1)
  const notice = screen.getByRole('status').closest('.notification-host')
  if (!notice) throw new Error('Notification host missing')
  fireEvent.mouseEnter(notice)
  act(() => vi.advanceTimersByTime(20_000))
  expect(screen.getByRole('status').textContent).toBe('Saved.')
  fireEvent.mouseLeave(notice)
  fireEvent.click(screen.getByText('Fail'))
  act(() => vi.advanceTimersByTime(6000))
  expect(notice.querySelector('.notification')?.getAttribute('data-closing')).toBe('true')
  act(() => vi.advanceTimersByTime(180))
  expect(screen.queryByRole('status')).toBeNull()
  expect(screen.getByRole('alert').textContent).toBe('Try again.')
  act(() => vi.advanceTimersByTime(60_000))
  expect(screen.getByRole('alert')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))
  act(() => vi.advanceTimersByTime(180))
  expect(screen.queryByRole('alert')).toBeNull()
  unmount()
  expect(document.documentElement.style.getPropertyValue('--notification-space')).toBe('')
})

it('retains messages on route-content changes and clears them at an account boundary', () => {
  const { rerender } = render(
    <NotificationProvider key="one">
      <Controls />
    </NotificationProvider>,
  )
  fireEvent.click(screen.getByText('Save'))
  rerender(
    <NotificationProvider key="one">
      <p>Another page</p>
    </NotificationProvider>,
  )
  expect(screen.getByRole('status').textContent).toBe('Saved.')
  rerender(
    <NotificationProvider key="two">
      <Controls />
    </NotificationProvider>,
  )
  expect(screen.queryByRole('status')).toBeNull()
})

it('dismisses without a motion delay when reduced motion is requested', () => {
  vi.useFakeTimers()
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  render(
    <NotificationProvider>
      <Controls />
    </NotificationProvider>,
  )
  fireEvent.click(screen.getByText('Save'))
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))
  act(() => vi.advanceTimersByTime(0))
  expect(screen.queryByRole('status')).toBeNull()
})
