import { useQuery } from '../../shared/api/useQuery'
import { loadPlanAvailability } from './api'

export function usePlanAvailability() {
  const query = useQuery('billing-plans', loadPlanAvailability)
  return {
    checkingAvailability: query.status === 'loading',
    aiBroadcasterEnabled: query.data?.aiBroadcasterEnabled === true,
    notice:
      query.status === 'error'
        ? 'AI plan availability could not be checked. Standard remains available.'
        : null,
  }
}
