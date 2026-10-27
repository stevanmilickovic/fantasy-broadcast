import { request } from '../../shared/api/http'
import type { FplClubShirt } from './types'
export const loadFplShirts = async (signal?: AbortSignal): Promise<FplClubShirt[]> =>
  (await request('/api/customer/fpl/shirts', { signal })).json()
