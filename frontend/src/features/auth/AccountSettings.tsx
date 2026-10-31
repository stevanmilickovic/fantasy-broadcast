import { useState, type FormEvent } from 'react'
import type { Navigate } from '../../app/useBrowserNavigation'
import { useMutation } from '../../shared/api/useMutation'
import { updateProfile } from './api'
import type { AuthUser } from './types'

export function AccountSettings({
  user,
  onUpdated,
  navigate,
}: {
  user: AuthUser
  onUpdated: (user: AuthUser) => void
  navigate: Navigate
}) {
  const [name, setName] = useState(user.displayName)
  const saving = useMutation()
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const result = await saving.run((signal) => updateProfile(name, signal))
    if (result) onUpdated(result.data)
  }
  return (
    <main className="account-shell">
      <form className="account-card" onSubmit={(event) => void submit(event)}>
        <button
          type="button"
          className="secondary-action"
          onClick={() => navigate(user.role === 'ADMIN' ? '/administration' : '/leagues')}
        >
          Back
        </button>
        <h1>Account settings</h1>
        <p>{user.email}</p>
        <label htmlFor="profile-name">Username</label>
        <input
          id="profile-name"
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            saving.reset()
          }}
          required
          maxLength={40}
          autoComplete="nickname"
        />
        <p>
          Names do not need to be unique. Other members of a league chat can see your email by
          selecting your name.
        </p>
        {saving.error && <p role="alert">{saving.error}</p>}
        {saving.status === 'success' && <p role="status">Username saved.</p>}
        <button disabled={saving.busy}>{saving.busy ? 'Saving…' : 'Save username'}</button>
      </form>
    </main>
  )
}
