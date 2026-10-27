export type AuthUser = {
  id: number
  email: string
  displayName: string
  role: 'USER' | 'ADMIN'
}

export type AuthResponse = {
  user: AuthUser
}

export type AuthOptions = {
  googleSignInEnabled: boolean
}

export type PendingRegistrationResponse = {
  email: string
  message: string
}
