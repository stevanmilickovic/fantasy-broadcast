import { useCallback, useEffect, useState } from 'react'

export type BrowserLocation = {
  pathname: string
  search: string
}

export type Navigate = (path: string, replace?: boolean) => void

const currentLocation = (): BrowserLocation => ({
  pathname: window.location.pathname,
  search: window.location.search,
})

export function useBrowserNavigation() {
  const [location, setLocation] = useState(currentLocation)

  useEffect(() => {
    const handlePopState = () => setLocation(currentLocation())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = useCallback<Navigate>((path, replace = false) => {
    window.history[replace ? 'replaceState' : 'pushState']({}, '', path)
    setLocation(currentLocation())
  }, [])

  return { location, navigate }
}
