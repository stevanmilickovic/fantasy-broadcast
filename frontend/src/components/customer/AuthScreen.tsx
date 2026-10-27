import { useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import {
  authenticate,
  loadAuthOptions,
  requestPasswordReset,
  requestRegistration,
  resetPassword,
  verifyRegistration,
} from '../../api/customerApi'
import type { Navigate } from '../../hooks/useBrowserNavigation'
import type { AuthResponse } from '../../types/customer'
import { LegalFooter } from './LegalFooter'

type Props = {
  pathname: string
  search: string
  onAuthenticated: (result: AuthResponse) => void
  onNavigate: Navigate
}
type AuthMode = 'login' | 'register' | 'forgot'

const PASSWORD_MIN_LENGTH = 12

export function AuthScreen({ pathname, search, onAuthenticated, onNavigate }: Props) {
  const [mode, setMode] = useState<AuthMode>(pathname === '/register' ? 'register' : 'login')
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
  const resettingPassword = pathname === '/reset-password'
  const resetToken = new URLSearchParams(search).get('token') ?? ''
  const verifyingRegistration = Boolean(pendingEmail)

  useEffect(() => {
    let isMounted = true
    loadAuthOptions()
      .then((options) => {
        if (isMounted) setGoogleSignInEnabled(options.googleSignInEnabled)
      })
      .catch(() => {
        if (isMounted) setGoogleSignInEnabled(false)
      })
    return () => {
      isMounted = false
    }
  }, [])

  const clearPasswords = () => {
    setPassword('')
    setConfirmPassword('')
    setShowPassword(false)
  }
  const validNewPassword = () => {
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
      return false
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return false
    }
    return true
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setMessage(null)
    if (resettingPassword) {
      if (!resetToken) {
        setError('This password reset link is invalid. Request a new one.')
        return
      }
      if (!validNewPassword()) return
      setBusy(true)
      try {
        await resetPassword(resetToken, password)
        clearPasswords()
        setMessage('Your password has been changed. You can now sign in.')
      } catch (requestError) {
        setError(errorMessage(requestError, 'Unable to reset your password.'))
      } finally {
        setBusy(false)
      }
      return
    }
    if (verifyingRegistration) {
      if (!verificationCode.trim()) {
        setError('Enter the verification code from your email.')
        return
      }
      setBusy(true)
      try {
        onAuthenticated(await verifyRegistration(pendingEmail, verificationCode))
      } catch (requestError) {
        setError(errorMessage(requestError, 'Unable to verify registration.'))
      } finally {
        setBusy(false)
      }
      return
    }
    if (!email.trim()) {
      setError(mode === 'login' ? 'Enter your email or username.' : 'Enter your email address.')
      return
    }
    if (mode === 'forgot') {
      setBusy(true)
      try {
        setMessage((await requestPasswordReset(email)).message)
      } catch (requestError) {
        setError(errorMessage(requestError, 'Unable to request password reset email.'))
      } finally {
        setBusy(false)
      }
      return
    }
    if (!password) {
      setError('Enter your password.')
      return
    }
    if (mode === 'register' && !validNewPassword()) return
    setBusy(true)
    try {
      if (mode === 'register') {
        const pending = await requestRegistration(email, password)
        setPendingEmail(pending.email)
        setMessage(pending.message)
        clearPasswords()
      } else onAuthenticated(await authenticate('login', email, password))
    } catch (requestError) {
      setError(errorMessage(requestError, 'Unable to continue.'))
    } finally {
      setBusy(false)
    }
  }

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setError(null)
    setMessage(null)
    setVerificationCode('')
    setPendingEmail('')
    clearPasswords()
  }
  const title = resettingPassword
    ? 'Choose a new password'
    : verifyingRegistration
      ? 'Check your email'
      : mode === 'login'
        ? 'Sign in'
        : mode === 'register'
          ? 'Create your account'
          : 'Reset your password'
  const description = resettingPassword
    ? 'Enter a new password for your Fantasy Broadcast account.'
    : verifyingRegistration
      ? `Enter the verification code sent to ${pendingEmail}.`
      : mode === 'login'
        ? 'Access your registered FPL leagues.'
        : mode === 'register'
          ? 'Register a league and prepare its broadcast.'
          : 'We will email you a secure link to choose a new password.'

  return (
    <main className="account-shell">
      <form className="account-card" onSubmit={submit} noValidate>
        <span className="kicker">Fantasy Broadcast</span>
        <h1>{title}</h1>
        <p>{description}</p>
        {!resettingPassword && !verifyingRegistration && (
          <>
            <label htmlFor="auth-email">{mode === 'login' ? 'Email or username' : 'Email'}</label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </>
        )}
        {(resettingPassword || (!verifyingRegistration && mode !== 'forgot')) && (
          <PasswordInput
            label={resettingPassword || mode === 'register' ? 'New password' : 'Password'}
            value={password}
            showPassword={showPassword}
            autoComplete={
              resettingPassword || mode === 'register' ? 'new-password' : 'current-password'
            }
            onChange={setPassword}
            onToggle={() => setShowPassword(!showPassword)}
          />
        )}
        {mode === 'login' && !resettingPassword && !verifyingRegistration && (
          <button
            type="button"
            className="forgot-password-link"
            onClick={() => switchMode('forgot')}
          >
            Forgot password?
          </button>
        )}
        {(resettingPassword || mode === 'register') && !verifyingRegistration && (
          <PasswordInput
            label="Confirm password"
            value={confirmPassword}
            showPassword={showPassword}
            autoComplete="new-password"
            onChange={setConfirmPassword}
            onToggle={() => setShowPassword(!showPassword)}
          />
        )}
        {verifyingRegistration && (
          <>
            <label htmlFor="verification-code">Verification code</label>
            <input
              id="verification-code"
              inputMode="numeric"
              value={verificationCode}
              onChange={(event) => setVerificationCode(event.target.value)}
              required
              autoComplete="one-time-code"
            />
          </>
        )}
        {message && <p className="auth-success">{message}</p>}
        {error && <p className="discovery-error">{error}</p>}
        {(!message || (!resettingPassword && mode !== 'forgot')) && (
          <button disabled={busy}>
            {submitLabel(resettingPassword, verifyingRegistration, mode, busy)}
          </button>
        )}
        {resettingPassword ? (
          <button
            type="button"
            className="secondary-action"
            onClick={() => {
              onNavigate('/login')
              window.location.reload()
            }}
          >
            Back to sign in
          </button>
        ) : (
          <div className="auth-secondary-actions">
            {mode !== 'forgot' && (
              <button
                type="button"
                className="secondary-action"
                onClick={() => switchMode(mode === 'register' ? 'login' : 'register')}
              >
                {verifyingRegistration
                  ? 'Use a different email'
                  : mode === 'register'
                    ? 'I already have an account'
                    : 'Create an account'}
              </button>
            )}
            {mode === 'forgot' && (
              <button
                type="button"
                className="secondary-action"
                onClick={() => switchMode('login')}
              >
                Back to sign in
              </button>
            )}
            {!verifyingRegistration && mode !== 'forgot' && googleSignInEnabled && <GoogleSignIn />}
          </div>
        )}
      </form>
      <LegalFooter onNavigate={onNavigate} className="account-legal-footer" />
    </main>
  )
}

function PasswordInput({
  label,
  value,
  showPassword,
  autoComplete,
  onChange,
  onToggle,
}: {
  label: string
  value: string
  showPassword: boolean
  autoComplete: 'current-password' | 'new-password'
  onChange: (value: string) => void
  onToggle: () => void
}) {
  const id = label.toLowerCase().replaceAll(' ', '-')
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <div className="password-field">
        <input
          id={id}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
          minLength={autoComplete === 'new-password' ? PASSWORD_MIN_LENGTH : 5}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          title={showPassword ? 'Hide password' : 'Show password'}
          onClick={onToggle}
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </>
  )
}

function GoogleSignIn() {
  return (
    <a
      className="google-auth-link"
      href="/oauth2/authorization/google"
      aria-label="Continue with Google"
    >
      <svg className="google-mark" aria-hidden="true" viewBox="0 0 24 24">
        <path
          fill="#4285f4"
          d="M23.49 12.27c0-.82-.07-1.6-.2-2.36H12v4.47h6.46a5.52 5.52 0 0 1-2.39 3.62v2.96h3.87c2.26-2.08 3.55-5.14 3.55-8.69"
        />
        <path
          fill="#34a853"
          d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-2.96c-1.07.72-2.44 1.14-4.07 1.14-3.13 0-5.78-2.11-6.73-4.96h-4v3.05A12 12 0 0 0 12 24"
        />
        <path fill="#fbbc05" d="M5.27 14.31a7.2 7.2 0 0 1 0-4.62V6.64h-4a12 12 0 0 0 0 10.72z" />
        <path
          fill="#ea4335"
          d="M12 4.73c1.76 0 3.34.61 4.58 1.8l3.44-3.44A11.55 11.55 0 0 0 12 0 12 12 0 0 0 1.27 6.64l4 3.05C6.22 6.84 8.87 4.73 12 4.73"
        />
      </svg>
      <span>Google</span>
    </a>
  )
}

function submitLabel(
  resettingPassword: boolean,
  verifyingRegistration: boolean,
  mode: AuthMode,
  busy: boolean,
) {
  if (busy) return 'Please wait…'
  if (resettingPassword) return 'Set new password'
  if (verifyingRegistration) return 'Verify email'
  if (mode === 'forgot') return 'Send reset link'
  return mode === 'login' ? 'Sign in' : 'Register'
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}
