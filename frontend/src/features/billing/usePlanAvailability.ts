import { useQuery } from '../../shared/api/useQuery'
import { loadPlanAvailability } from './api'

export function usePlanAvailability() {
  const query = useQuery('billing-plans', loadPlanAvailability)
  return {
    aiBroadcasterEnabled: query.data?.aiBroadcasterEnabled === true,
    notice:
      query.status === 'error'
        ? 'AI plan availability could not be checked. Standard remains available.'
        : query.data?.aiBroadcasterEnabled === false
          ? 'AI Broadcaster is currently unavailable for purchase. Standard is available.'
          : null,
  }
}
