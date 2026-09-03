import { useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { authenticate, loadAuthOptions, requestRegistration, verifyRegistration } from '../../api/customerApi'
import type { AuthResponse } from '../../types/customer'

type Props = { onAuthenticated: (result: AuthResponse) => void }

const REGISTER_PASSWORD_MIN_LENGTH = 12

export function AuthScreen({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [pendingEmail, setPendingEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [googleSignInEnabled, setGoogleSignInEnabled] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let isMounted = true
    loadAuthOptions()
      .then((options) => { if (isMounted) setGoogleSignInEnabled(options.googleSignInEnabled) })
      .catch(() => { if (isMounted) setGoogleSignInEnabled(false) })
    return () => { isMounted = false }
  }, [])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setMessage(null)
    if (pendingEmail) {
      if (!verificationCode.trim()) {
        setError('Enter the verification code from your email.')
        return
      }
      setBusy(true)
      try {
        onAuthenticated(await verifyRegistration(pendingEmail, verificationCode))
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Unable to verify registration.')
      } finally { setBusy(false) }
      return
    }
    if (!email.trim()) {
      setError(mode === 'login' ? 'Enter your email or username.' : 'Enter your email address.')
      return
    }
    if (!password) {
      setError('Enter your password.')
      return
    }
    if (mode === 'register' && password.length < REGISTER_PASSWORD_MIN_LENGTH) {
      setError(`Password must be at least ${REGISTER_PASSWORD_MIN_LENGTH} characters.`)
      return
    }
    if (mode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      if (mode === 'register') {
        const pending = await requestRegistration(email, password)
        setPendingEmail(pending.email)
        setMessage(pending.message)
        setPassword('')
        setConfirmPassword('')
        setShowPassword(false)
      } else {
        onAuthenticated(await authenticate('login', email, password))
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to continue.')
    } finally { setBusy(false) }
  }

  const passwordInputType = showPassword ? 'text' : 'password'
  const verifyingRegistration = Boolean(pendingEmail)

  return <main className="account-shell"><form className="account-card" onSubmit={submit} noValidate>
    <span className="kicker">Fantasy Broadcast</span>
    <h1>{verifyingRegistration ? 'Check your email' : mode === 'login' ? 'Sign in' : 'Create your account'}</h1>
    <p>{verifyingRegistration ? `Enter the verification code sent to ${pendingEmail}.` : mode === 'login' ? 'Access your registered FPL leagues.' : 'Register a league and prepare its broadcast.'}</p>
    {!verifyingRegistration && <><label>{mode === 'login' ? 'Email or username' : 'Email'}</label><input value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
    <label>Password</label><div className="password-field"><input type={passwordInputType} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={mode === 'login' ? 5 : REGISTER_PASSWORD_MIN_LENGTH} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
    {mode === 'register' && <><label>Confirm password</label><div className="password-field"><input type={passwordInputType} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={REGISTER_PASSWORD_MIN_LENGTH} autoComplete="new-password" /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} title={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></>}</>}
    {verifyingRegistration && <><label>Verification code</label><input inputMode="numeric" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} required autoComplete="one-time-code" /></>}
    {message && <p className="auth-success">{message}</p>}
    {error && <p className="discovery-error">{error}</p>}
    <button disabled={busy}>{busy ? 'Please wait…' : verifyingRegistration ? 'Verify email' : mode === 'login' ? 'Sign in' : 'Register'}</button>
    <div className="auth-secondary-actions">
      <button type="button" className="secondary-action" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); setMessage(null); setConfirmPassword(''); setVerificationCode(''); setPendingEmail(''); setShowPassword(false) }}>
        {verifyingRegistration ? 'Use a different email' : mode === 'login' ? 'Create an account' : 'I already have an account'}
      </button>
      {!verifyingRegistration && googleSignInEnabled && <a className="google-auth-link" href="/oauth2/authorization/google" aria-label="Continue with Google"><svg className="google-mark" aria-hidden="true" viewBox="0 0 24 24"><path fill="#4285f4" d="M23.49 12.27c0-.82-.07-1.6-.2-2.36H12v4.47h6.46a5.52 5.52 0 0 1-2.39 3.62v2.96h3.87c2.26-2.08 3.55-5.14 3.55-8.69"/><path fill="#34a853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-2.96c-1.07.72-2.44 1.14-4.07 1.14-3.13 0-5.78-2.11-6.73-4.96h-4v3.05A12 12 0 0 0 12 24"/><path fill="#fbbc05" d="M5.27 14.31a7.2 7.2 0 0 1 0-4.62V6.64h-4a12 12 0 0 0 0 10.72z"/><path fill="#ea4335" d="M12 4.73c1.76 0 3.34.61 4.58 1.8l3.44-3.44A11.55 11.55 0 0 0 12 0 12 12 0 0 0 1.27 6.64l4 3.05C6.22 6.84 8.87 4.73 12 4.73"/></svg><span>Google</span></a>}
    </div>
  </form></main>
}
