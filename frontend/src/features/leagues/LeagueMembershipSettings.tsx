import { useMutation } from '../../shared/api/useMutation'
import { decideFollowRequest, setLeaguePrivacy } from './api'
import { useLeagueRequests } from './useLeagueRequests'
import type { RegisteredLeague } from './types'

export function LeagueMembershipSettings({
  league,
  onChanged,
}: {
  league: RegisteredLeague
  onChanged: () => void
}) {
  const requests = useLeagueRequests(league.id)
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
    <section className="league-membership-settings" aria-labelledby="league-privacy-title">
      <h2 id="league-privacy-title">Privacy and followers</h2>
      <div className="league-privacy-control">
        <div>
          <h3 id="league-private-label">Private league</h3>
          <p id="league-private-description">
            {league.privateLeague
              ? 'New followers need your approval. Existing followers keep access.'
              : 'Anyone signed in can follow this league.'}
          </p>
        </div>
        <button
          className="league-privacy-switch"
          type="button"
          role="switch"
          aria-checked={!!league.privateLeague}
          aria-labelledby="league-private-label"
          aria-describedby="league-private-description"
          disabled={saving.busy}
          onClick={() => void changePrivacy(!league.privateLeague)}
        >
          <span aria-hidden="true" />
        </button>
      </div>
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
          <div className="league-request-actions">
            <button disabled={saving.busy} onClick={() => void decide(request.userId, true)}>
              Approve
            </button>
            <button disabled={saving.busy} onClick={() => void decide(request.userId, false)}>
              Reject
            </button>
          </div>
        </div>
      ))}
      {(saving.error || requests.error) && <p role="alert">{saving.error ?? requests.error}</p>}
    </section>
  )
}
