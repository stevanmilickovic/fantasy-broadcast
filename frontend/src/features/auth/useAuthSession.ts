import { useCallback, useEffect, useState } from 'react'
import type { Navigate } from '../../app/useBrowserNavigation'
import { loadCurrentUser, logout } from './api'
import type { AuthResponse, AuthUser } from './types'
import { consumeRegistrationIntent, type RegistrationDestination } from './registrationIntent'

export function useAuthSession(navigate: Navigate) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    loadCurrentUser()
      .then((currentUser) => {
        if (isMounted) {
          setUser(currentUser)
          if (currentUser && window.location.pathname === '/') {
            const destination = consumeRegistrationIntent()
            if (destination) navigate(destination, true)
          }
        }
      })
      .catch(() => {
        if (isMounted) setUser(null)
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })
    return () => {
      isMounted = false
    }
  }, [navigate])

  const handleAuthenticated = useCallback(
    async (result: AuthResponse, destination?: RegistrationDestination) => {
      setUser(result.user)
      const landingPath = result.user.role === 'ADMIN' ? '/administration' : '/leagues'
      const savedDestination = consumeRegistrationIntent()
      navigate(destination ?? savedDestination ?? landingPath, true)
    },
    [navigate],
  )

  const signOut = useCallback(async () => {
    await logout().catch(() => undefined)
    setUser(null)
    navigate('/', true)
  }, [navigate])

  return { user, isLoading, handleAuthenticated, signOut, updateUser: setUser }
}
