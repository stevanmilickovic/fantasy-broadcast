import { useCallback, useEffect, useState } from 'react'
import type { Navigate } from '../../app/useBrowserNavigation'
import { loadCurrentUser, logout } from './api'
import type { AuthResponse, AuthUser } from './types'

export function useAuthSession(navigate: Navigate) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    loadCurrentUser()
      .then((currentUser) => {
        if (isMounted) setUser(currentUser)
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
  }, [])

  const handleAuthenticated = useCallback(
    async (result: AuthResponse) => {
      setUser(result.user)
      const landingPath = result.user.role === 'ADMIN' ? '/administration' : '/leagues'
      navigate(landingPath, true)
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
