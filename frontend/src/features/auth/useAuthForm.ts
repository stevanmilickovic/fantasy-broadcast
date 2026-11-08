import { useState } from 'react'
import { useMutation } from '../../shared/api/useMutation'
import { useQuery } from '../../shared/api/useQuery'
import {
  authenticate,
  loadAuthOptions,
  requestPasswordReset,
  requestRegistration,
  resetPassword,
  verifyRegistration,
} from './api'
import type { AuthResponse } from './types'

type AuthMode = 'login' | 'register' | 'forgot'
type AuthFlow =
  { step: AuthMode } | { step: 'verify'; email: string } | { step: 'reset'; token: string }
const PASSWORD_MIN_LENGTH = 12

export function useAuthForm(
  pathname: string,
  search: string,
  onAuthenticated: (result: AuthResponse) => void | Promise<void>,
  onPasswordReset?: () => void,
) {
  const [flow, setFlow] = useState<AuthFlow>(() =>
    pathname === '/reset-password'
      ? { step: 'reset', token: new URLSearchParams(search).get('token') ?? '' }
      : { step: pathname === '/register' ? 'register' : 'login' },
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const authOptions = useQuery('auth-options', loadAuthOptions)
  const mutation = useMutation()
  const clearPasswords = () => {
    setPassword('')
    setConfirmPassword('')
    setShowPassword(false)
  }
  const switchMode = (mode: AuthMode) => {
    mutation.reset()
    setFlow({ step: mode })
    setValidationError(null)
    setMessage(null)
    setVerificationCode('')
    clearPasswords()
  }
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setValidationError(null)
    setMessage(null)
    if (flow.step === 'reset' && !flow.token) {
      setValidationError('This password reset link is invalid. Request a new one.')
      return
    }
    if (flow.step === 'register' || flow.step === 'reset') {
      if (password.length < PASSWORD_MIN_LENGTH) {
        setValidationError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
        return
      }
      if (password !== confirmPassword) {
        setValidationError('Passwords do not match.')
        return
      }
    }
    if (flow.step === 'verify' && !verificationCode.trim()) {
      setValidationError('Enter the verification code from your email.')
      return
    }
    if (['login', 'register', 'forgot'].includes(flow.step) && !email.trim()) {
      setValidationError('Enter your email address.')
      return
    }
    if (flow.step === 'login' && !password) {
      setValidationError('Enter your password.')
      return
    }
    switch (flow.step) {
      case 'reset': {
        const result = await mutation.run((signal) => resetPassword(flow.token, password, signal))
        if (result) {
          clearPasswords()
          setMessage('Your password has been changed. You can now sign in.')
          onPasswordReset?.()
        }
        break
      }
      case 'verify': {
        const result = await mutation.run((signal) =>
          verifyRegistration(flow.email, verificationCode, signal),
        )
        if (result) await onAuthenticated(result.data)
        break
      }
      case 'forgot': {
        const result = await mutation.run((signal) => requestPasswordReset(email, signal))
        if (result) setMessage(result.data.message)
        break
      }
      case 'register': {
        const result = await mutation.run((signal) => requestRegistration(email, password, signal))
        if (result) {
          setFlow({ step: 'verify', email: result.data.email })
          setMessage(result.data.message)
          clearPasswords()
        }
        break
      }
      case 'login': {
        const result = await mutation.run((signal) => authenticate(email, password, signal))
        if (result) await onAuthenticated(result.data)
      }
    }
  }
  const mode: AuthMode =
    flow.step === 'verify' ? 'register' : flow.step === 'reset' ? 'login' : flow.step
  return {
    mode,
    resettingPassword: flow.step === 'reset',
    verifyingRegistration: flow.step === 'verify',
    pendingEmail: flow.step === 'verify' ? flow.email : '',
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    verificationCode,
    setVerificationCode,
    message,
    error: validationError ?? mutation.error,
    showPassword,
    setShowPassword,
    busy: mutation.busy,
    googleSignInEnabled: authOptions.data?.googleSignInEnabled ?? false,
    submit,
    switchMode,
  }
}
