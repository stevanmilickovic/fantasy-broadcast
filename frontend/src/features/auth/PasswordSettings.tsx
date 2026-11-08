import { useState, type FormEvent } from 'react'
import { useMutation } from '../../shared/api/useMutation'
import { useQuery } from '../../shared/api/useQuery'
import { changePassword, loadPasswordCapability } from './api'
import { PasswordInput } from './PasswordInput'

export function PasswordSettings({ onChanged }: { onChanged: () => void }) {
  const capability = useQuery('password-capability', loadPasswordCapability)
  const mutation = useMutation()
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [show, setShow] = useState(false)
  const [validation, setValidation] = useState<string | null>(null)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (mutation.busy) return
    if (password !== confirmation) {
      setValidation('Passwords do not match.')
      return
    }
    setValidation(null)
    if (await mutation.run((signal) => changePassword(current, password, signal))) {
      setCurrent('')
      setPassword('')
      setConfirmation('')
      setShow(false)
      onChanged()
    }
  }
  return (
    <section className="account-card" aria-labelledby="account-security-title">
      <h2 id="account-security-title">Sign-in and security</h2>
      {capability.status === 'loading' && <p role="status">Loading sign-in settings…</p>}
      {capability.error && (
        <p role="alert">
          {capability.error}{' '}
          <button type="button" onClick={capability.refresh}>
            Retry
          </button>
        </p>
      )}
      {capability.data?.hasPassword === false && (
        <>
          <p>
            You sign in with Google. Manage your password and recovery options in your Google
            account.
          </p>
          <a href="https://myaccount.google.com/security">Google account security</a>
        </>
      )}
      {capability.data?.hasPassword === true && (
        <form className="account-password-form" onSubmit={(event) => void submit(event)}>
          <p>
            Changing your password signs out all existing sessions. You will need to sign in again.
          </p>
          <PasswordInput
            label="Current password"
            value={current}
            showPassword={show}
            autoComplete="current-password"
            onChange={setCurrent}
            onToggle={() => setShow(!show)}
            disabled={mutation.busy}
          />
          <PasswordInput
            label="New password"
            value={password}
            showPassword={show}
            autoComplete="new-password"
            onChange={setPassword}
            onToggle={() => setShow(!show)}
            disabled={mutation.busy}
          />
          <PasswordInput
            label="Confirm new password"
            value={confirmation}
            showPassword={show}
            autoComplete="new-password"
            onChange={setConfirmation}
            onToggle={() => setShow(!show)}
            disabled={mutation.busy}
          />
          <p>Use 12–200 characters.</p>
          {(validation || mutation.error) && <p role="alert">{validation ?? mutation.error}</p>}
          <button disabled={mutation.busy}>
            {mutation.busy ? 'Changing password…' : 'Change password'}
          </button>
        </form>
      )}
    </section>
  )
}
