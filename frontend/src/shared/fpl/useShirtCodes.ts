import { useEffect, useState } from 'react'
import { loadFplShirts } from './api'
import type { FplClubShirt } from './types'

export function useShirtCodes(override?: FplClubShirt[]): FplClubShirt[] {
  const [codes, setCodes] = useState<FplClubShirt[]>([])
  useEffect(() => {
    if (override) return
    const controller = new AbortController()
    loadFplShirts(controller.signal)
      .then((teams) => {
        if (controller.signal.aborted) return
        setCodes(teams)
        for (const team of teams)
          for (const size of [66, 110]) {
            const shirt = new Image()
            shirt.src = `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${team.code}-${size}.png`
          }
      })
      .catch(() => {
        // Shirts are decorative; the team and player names remain available.
      })
    return () => controller.abort()
  }, [override])
  return override ?? codes
}
