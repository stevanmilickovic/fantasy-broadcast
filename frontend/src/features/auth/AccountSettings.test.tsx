import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { AccountSettings } from './AccountSettings'
import { updateProfile } from './api'

vi.mock('./api', () => ({ updateProfile: vi.fn() }))

test('saving a username refreshes the signed-in identity', async () => {
  const user = { id: 1, email: 'user@example.com', displayName: 'Old', role: 'USER' as const }
  const onUpdated = vi.fn()
  vi.mocked(updateProfile).mockResolvedValue({ ...user, displayName: 'New' })
  render(<AccountSettings user={user} onUpdated={onUpdated} navigate={vi.fn()} />)
  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'New' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save username' }))
  await waitFor(() => expect(onUpdated).toHaveBeenCalledWith({ ...user, displayName: 'New' }))
})

test('a taken username remains editable and does not update the session', async () => {
  const user = { id: 1, email: 'user@example.com', displayName: 'Old', role: 'USER' as const }
  const onUpdated = vi.fn()
  vi.mocked(updateProfile).mockRejectedValue(new Error('That username is already taken.'))
  render(<AccountSettings user={user} onUpdated={onUpdated} navigate={vi.fn()} />)
  const input = screen.getByLabelText('Username')
  fireEvent.change(input, { target: { value: 'Taken' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save username' }))
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('already taken'))
  expect((input as HTMLInputElement).value).toBe('Taken')
  expect(onUpdated).not.toHaveBeenCalled()
})
