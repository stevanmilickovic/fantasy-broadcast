import { useCallback } from 'react'
import { useMutation } from '../../shared/api/useMutation'
import { useQuery } from '../../shared/api/useQuery'
import { decideFollowRequest, loadLeagueRequests, setLeaguePrivacy } from './api'
import type { RegisteredLeague } from './types'

export function LeagueMembershipSettings({
  league,
  onChanged,
}: {
  league: RegisteredLeague
  onChanged: () => void
}) {
  const load = useCallback(
    (signal: AbortSignal) => loadLeagueRequests(league.id, signal),
    [league.id],
  )
  const requests = useQuery(`requests:${league.id}`, load)
  const saving = useMutation()
  const changePrivacy = async (privateLeague: boolean) => {
    if (await saving.run((signal) => setLeaguePrivacy(league.id, privateLeague, signal))) {
      onChanged()
      requests.refresh()
    }
  }
  const decide = async (userId: number, approve: boolean) => {
    if (await saving.run((signal) => decideFollowRequest(league.id, userId, approve, signal)))
      requests.refresh()
  }
  const pending = requests.data?.filter((request) => request.status === 'PENDING') ?? []
  return (
    <details className="league-membership-settings">
      <summary>Privacy and follow requests</summary>
      <label>
        <input
          type="checkbox"
          checked={!!league.privateLeague}
          disabled={saving.busy}
          onChange={(event) => void changePrivacy(event.target.checked)}
        />{' '}
        Private league
      </label>
      <p>
        {league.privateLeague
          ? 'New followers need your approval. Existing followers keep access.'
          : 'Anyone signed in can follow this league.'}
      </p>
      <h3>Follow requests ({pending.length})</h3>
      <button type="button" onClick={requests.refresh}>
        Refresh requests
      </button>
      {requests.status === 'loading' && <p role="status">Loading requests…</p>}
      {requests.status === 'success' && pending.length === 0 && <p>No pending requests.</p>}
      {pending.map((request) => (
        <div className="league-membership-request" key={request.userId}>
          <span>
            <strong>{request.displayName}</strong>
            <small>{request.email}</small>
          </span>
          <button disabled={saving.busy} onClick={() => void decide(request.userId, true)}>
            Approve
          </button>
          <button disabled={saving.busy} onClick={() => void decide(request.userId, false)}>
            Reject
          </button>
        </div>
      ))}
      {(saving.error || requests.error) && <p role="alert">{saving.error ?? requests.error}</p>}
    </details>
  )
}
