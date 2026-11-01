import { useEffect, useState } from 'react'
import { loadFplShirts } from './api'
import { shirtUrlFor } from './shirts'
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
          for (const url of [
            shirtUrlFor(team.code, 'DEF', 66),
            shirtUrlFor(team.code, 'DEF'),
            shirtUrlFor(team.code, 'GKP'),
          ]) {
            if (!url) continue
            const shirt = new Image()
            shirt.src = url
          }
      })
      .catch(() => {
        // Shirts are decorative; the team and player names remain available.
      })
    return () => controller.abort()
  }, [override])
  return override ?? codes
}
