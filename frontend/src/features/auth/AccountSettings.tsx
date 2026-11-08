import { useState, type FormEvent } from 'react'
import { ArrowLeft } from 'lucide-react'
import type { Navigate } from '../../app/useBrowserNavigation'
import { useMutation } from '../../shared/api/useMutation'
import { updateProfile } from './api'
import type { AuthUser } from './types'
import { useNotifications } from '../../shared/ui/notifications'
import { PasswordSettings } from './PasswordSettings'

export function AccountSettings({
  user,
  onUpdated,
  navigate,
  onPasswordChanged,
}: {
  user: AuthUser
  onUpdated: (user: AuthUser) => void
  navigate: Navigate
  onPasswordChanged: () => void
}) {
  const [name, setName] = useState(user.displayName)
  const saving = useMutation()
  const { notify } = useNotifications()
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const result = await saving.run((signal) => updateProfile(name, signal))
    if (result) {
      setName(result.data.displayName)
      onUpdated(result.data)
      notify('Username saved.', { kind: 'success' })
    }
  }
  return (
    <main className="account-shell account-settings">
      <button
        type="button"
        className="checkout-back"
        onClick={() => navigate(user.role === 'ADMIN' ? '/administration' : '/leagues')}
      >
        <ArrowLeft size={17} /> Back
      </button>
      <form className="account-card" onSubmit={(event) => void submit(event)}>
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
          maxLength={80}
          aria-invalid={Boolean(saving.error)}
          aria-describedby={saving.error ? 'profile-name-error' : 'profile-name-help'}
          autoComplete="nickname"
        />
        <p id="profile-name-help">
          Choose a unique username, up to 40 characters. Your account email stays private.
        </p>
        {saving.error && (
          <p id="profile-name-error" role="alert">
            {saving.error}
          </p>
        )}
        <button disabled={saving.busy}>{saving.busy ? 'Saving…' : 'Save username'}</button>
      </form>
      <PasswordSettings onChanged={onPasswordChanged} />
      <section className="account-card" aria-labelledby="account-deletion-title">
        <h2 id="account-deletion-title">Account deletion</h2>
        <p>
          Request a review of your account and data for deletion. Active subscriptions must be
          canceled first.
        </p>
        <button
          type="button"
          className="secondary-action"
          onClick={() => navigate('/account-deletion')}
        >
          Delete account
        </button>
      </section>
    </main>
  )
}
