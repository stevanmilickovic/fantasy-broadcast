import { request } from '../../shared/api/http'
import type { FplLeagueType } from '../../shared/fpl/types'
import type { LeaguePaymentPreview, PaddleCheckout } from './types'
export const loadPlanAvailability = async (
  signal: AbortSignal,
): Promise<{ aiBroadcasterEnabled: boolean }> =>
  (await request('/api/paddle/plans', { signal })).json()

export const loadPaymentConfiguration = async (
  signal: AbortSignal,
): Promise<{ clientSideToken: string }> =>
  (await request('/api/paddle/configuration', { signal })).json()
export const previewLeaguePayment = async (
  fplLeagueId: string,
  leagueType: FplLeagueType,
  signal?: AbortSignal,
): Promise<LeaguePaymentPreview> =>
  (
    await request(
      `/api/customer/league-payment/preview?${new URLSearchParams({ fplLeagueId, leagueType })}`,
      { signal },
    )
  ).json()

export const createPaddleCheckout = async (
  fplLeagueId: string,
  leagueType: FplLeagueType,
  plan: 'STANDARD' | 'AI_BROADCASTER',
  signal?: AbortSignal,
): Promise<PaddleCheckout> =>
  (
    await request('/api/customer/league-payment/checkout', {
      signal,
      method: 'POST',
      body: JSON.stringify({ fplLeagueId: Number(fplLeagueId), leagueType, plan }),
    })
  ).json()
