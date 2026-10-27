import { request } from '../../shared/api/http'
import type { PlayerDetails } from './types'
export const loadPlayerDetails = async (
  leagueId: number,
  playerId: number,
  gameweek: number,
  signal?: AbortSignal,
): Promise<PlayerDetails> =>
  (
    await request(
      `/api/customer/leagues/${leagueId}/players/${playerId}?${new URLSearchParams({ gameweek: String(gameweek) })}`,
      { signal },
    )
  ).json()
