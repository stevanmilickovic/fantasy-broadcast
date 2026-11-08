import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { PasswordSettings } from './PasswordSettings'
import { changePassword, loadPasswordCapability } from './api'

vi.mock('./api', () => ({ changePassword: vi.fn(), loadPasswordCapability: vi.fn() }))
beforeEach(() => {
  vi.mocked(loadPasswordCapability).mockResolvedValue({ hasPassword: true })
  vi.mocked(changePassword).mockResolvedValue()
})

test('Google-only accounts get provider security guidance', async () => {
  vi.mocked(loadPasswordCapability).mockResolvedValue({ hasPassword: false })
  render(<PasswordSettings onChanged={vi.fn()} />)
  await screen.findByText(/You sign in with Google/)
  expect(screen.queryByLabelText('Current password')).toBeNull()
  expect(screen.getByRole('link', { name: 'Google account security' }).getAttribute('href')).toBe(
    'https://myaccount.google.com/security',
  )
})

test('mismatch and backend rejection preserve editable fields; success clears credentials', async () => {
  const done = vi.fn()
  render(<PasswordSettings onChanged={done} />)
  const current = await screen.findByLabelText('Current password')
  fireEvent.change(current, { target: { value: 'old-password-123' } })
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'new-password-123' } })
  fireEvent.change(screen.getByLabelText('Confirm new password'), {
    target: { value: 'different-password' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Change password' }))
  expect(screen.getByRole('alert').textContent).toContain('do not match')
  expect(changePassword).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Confirm new password'), {
    target: { value: 'new-password-123' },
  })
  vi.mocked(changePassword).mockRejectedValueOnce(new Error('Current password is incorrect.'))
  fireEvent.click(screen.getByRole('button', { name: 'Change password' }))
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('incorrect'))
  expect(done).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Change password' }))
  await waitFor(() => expect(done).toHaveBeenCalledTimes(1))
  expect((current as HTMLInputElement).value).toBe('')
  expect(changePassword).toHaveBeenLastCalledWith(
    'old-password-123',
    'new-password-123',
    expect.any(AbortSignal),
  )
})
