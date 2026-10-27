import { useCallback, useEffect, useState } from 'react'
import { loadCurrentUser, loadRegisteredLeagues, logout } from '../api/customerApi'
import type { AuthResponse, AuthUser } from '../types/customer'
import type { Navigate } from './useBrowserNavigation'

const customerLandingPath = async () => {
  const leagues = await loadRegisteredLeagues()
  if (leagues.length === 0) return '/leagues/new'
  if (leagues.length === 1) return `/league?leagueId=${leagues[0].id}`
  return '/leagues'
}

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
      const landingPath =
        result.user.role === 'ADMIN' ? '/administration' : await customerLandingPath()
      navigate(landingPath, true)
    },
    [navigate],
  )

  const signOut = useCallback(async () => {
    await logout().catch(() => undefined)
    setUser(null)
    navigate('/', true)
  }, [navigate])

  return { user, isLoading, handleAuthenticated, signOut }
}
