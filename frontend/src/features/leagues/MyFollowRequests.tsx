import { useMutation } from '../../shared/api/useMutation'
import { useQuery } from '../../shared/api/useQuery'
import { cancelFollowRequest, followLeague, loadFollowRequests } from './api'

export function MyFollowRequests({ onChanged }: { onChanged: () => void }) {
  const requests = useQuery('my-follow-requests', loadFollowRequests)
  const saving = useMutation()
  const update = async (leagueId: number, retry: boolean) => {
    if (
      await saving.run(async (signal) => {
        if (retry) await followLeague(leagueId, signal)
        else await cancelFollowRequest(leagueId, signal)
      })
    ) {
      requests.refresh()
      onChanged()
    }
  }
  return (
    <section className="league-follow-requests" aria-label="Your follow requests">
      <h2>Your follow requests</h2>
      <button
        onClick={() => {
          requests.refresh()
          onChanged()
        }}
      >
        Refresh
      </button>
      {requests.status === 'loading' && <p role="status">Loading requests…</p>}
      {requests.status === 'success' && !requests.data.length && <p>No outstanding requests.</p>}
      {requests.data?.map((request) => (
        <div className="league-membership-request" key={request.leagueId}>
          <span>
            <strong>{request.leagueName}</strong>
            <small>
              {request.status === 'PENDING' ? 'Awaiting owner approval' : 'Request declined'}
            </small>
          </span>
          {request.status === 'REJECTED' && (
            <button disabled={saving.busy} onClick={() => void update(request.leagueId, true)}>
              Request again
            </button>
          )}
          <button disabled={saving.busy} onClick={() => void update(request.leagueId, false)}>
            {request.status === 'PENDING' ? 'Cancel request' : 'Dismiss'}
          </button>
        </div>
      ))}
      {(requests.error || saving.error) && <p role="alert">{requests.error ?? saving.error}</p>}
    </section>
  )
}
