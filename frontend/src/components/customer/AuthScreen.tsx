import { useState } from 'react'
import { authenticate } from '../../api/customerApi'
import type { AuthResponse } from '../../types/customer'

type Props = { onAuthenticated: (result: AuthResponse) => void }

export function AuthScreen({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      onAuthenticated(await authenticate(mode, email, password))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to continue.')
    } finally { setBusy(false) }
  }

  return <main className="account-shell"><form className="account-card" onSubmit={submit}>
    <span className="kicker">STK Broadcast</span>
    <h1>{mode === 'login' ? 'Sign in' : 'Create your account'}</h1>
    <p>{mode === 'login' ? 'Access your registered FPL leagues.' : 'Register a league and prepare its broadcast.'}</p>
    <label>{mode === 'login' ? 'Email or username' : 'Email'}</label><input value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
    <label>Password</label><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={5} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
    {error && <p className="discovery-error">{error}</p>}
    <button disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Register'}</button>
    <button type="button" className="secondary-action" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null) }}>
      {mode === 'login' ? 'Create an account' : 'I already have an account'}
    </button>
  </form></main>
}
