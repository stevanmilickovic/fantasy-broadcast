import { useCallback, useRef, useState } from 'react'
import { useMutation } from '../../shared/api/useMutation'
import { useQuery } from '../../shared/api/useQuery'
import { Pagination } from '../../shared/ui/Pagination'
import {
  decideFollowRequest,
  loadLeagueFollowers,
  removeLeagueFollower,
  setLeaguePrivacy,
} from './api'
import { useLeagueRequests } from './useLeagueRequests'
import type { LeagueFollower, RegisteredLeague } from './types'

export function LeagueMembershipSettings({
  league,
  onChanged,
}: {
  league: RegisteredLeague
  onChanged: () => void
}) {
  const requests = useLeagueRequests(league.id)
  const saving = useMutation()
  const removing = useMutation()
  const busy = saving.busy || removing.busy
  const [page, setPage] = useState(0)
  const followersHeading = useRef<HTMLHeadingElement>(null)
  const loadFollowers = useCallback(
    (signal: AbortSignal) => loadLeagueFollowers(league.id, page, signal),
    [league.id, page],
  )
  const followers = useQuery(`league-followers:${league.id}:${page}`, loadFollowers)
  const changePrivacy = async (privateLeague: boolean) => {
    if (await saving.run((signal) => setLeaguePrivacy(league.id, privateLeague, signal))) {
      onChanged()
      requests.refresh()
      if (!privateLeague) followers.refresh()
    }
  }
  const decide = async (userId: number, approve: boolean) => {
    if (await saving.run((signal) => decideFollowRequest(league.id, userId, approve, signal))) {
      requests.refresh()
      if (approve) followers.refresh()
    }
  }
  const remove = async (follower: LeagueFollower) => {
    const access = league.privateLeague
      ? 'They’ll need approval to follow again.'
      : 'They can follow again while the league is public.'
    if (
      !window.confirm(
        `Remove ${follower.displayName} (#${follower.userId}) from this league? ${access}`,
      )
    )
      return
    if (await removing.run((signal) => removeLeagueFollower(league.id, follower.userId, signal))) {
      followersHeading.current?.focus()
      followers.refresh()
    }
  }
  const pending = requests.data?.filter((request) => request.status === 'PENDING') ?? []
  return (
    <section className="league-membership-settings" aria-label="Privacy and followers">
      <div className="league-privacy-control">
        <h2 id="league-private-label">Private league</h2>
        <button
          className="league-privacy-switch"
          type="button"
          role="switch"
          aria-checked={!!league.privateLeague}
          aria-labelledby="league-private-label"
          aria-describedby="league-private-description"
          disabled={busy}
          onClick={() => void changePrivacy(!league.privateLeague)}
        >
          <span aria-hidden="true" />
        </button>
        <p id="league-private-description">
          {league.privateLeague
            ? 'New followers need approval. Existing followers keep access.'
            : 'Anyone signed in can follow this league.'}
        </p>
      </div>
      <div className="league-request-heading">
        <h2>Follow requests{requests.data ? ` (${pending.length})` : ''}</h2>
        <button
          className="secondary-action"
          type="button"
          aria-label="Refresh requests"
          onClick={requests.refresh}
        >
          Refresh
        </button>
      </div>
      {requests.status === 'loading' && <p role="status">Loading requests…</p>}
      {requests.status === 'success' && pending.length === 0 && <p>No pending requests.</p>}
      {pending.map((request) => (
        <div className="league-membership-request" key={request.userId}>
          <span>
            <strong>{request.displayName}</strong>
          </span>
          <div className="league-request-actions">
            <button disabled={busy} onClick={() => void decide(request.userId, true)}>
              Approve
            </button>
            <button disabled={busy} onClick={() => void decide(request.userId, false)}>
              Reject
            </button>
          </div>
        </div>
      ))}
      {(saving.error || requests.error) && <p role="alert">{saving.error ?? requests.error}</p>}
      <section className="league-followers" aria-labelledby="league-followers-title">
        <h2 id="league-followers-title" ref={followersHeading} tabIndex={-1}>
          Followers{followers.data ? ` (${followers.data.totalItems})` : ''}
        </h2>
        {followers.status === 'loading' && <p role="status">Loading followers…</p>}
        {removing.error && <p role="alert">{removing.error}</p>}
        {followers.error && (
          <p role="alert">
            {followers.error}{' '}
            <button type="button" onClick={followers.refresh}>
              Retry
            </button>
          </p>
        )}
        {followers.data &&
          (followers.data.items.length === 0 ? (
            <p>No followers yet.</p>
          ) : (
            <>
              <ul>
                {followers.data.items.map((follower) => (
                  <li key={follower.userId}>
                    <span>
                      <strong>{follower.displayName}</strong> <small>#{follower.userId}</small>
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${follower.displayName} (#${follower.userId})`}
                      disabled={busy}
                      onClick={() => void remove(follower)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              {followers.data.totalItems > followers.data.size && (
                <Pagination
                  page={followers.data.page}
                  totalItems={followers.data.totalItems}
                  size={followers.data.size}
                  label="Follower pages"
                  busy={busy}
                  onPageChange={(nextPage) => {
                    followersHeading.current?.focus()
                    setPage(nextPage)
                  }}
                />
              )}
            </>
          ))}
      </section>
    </section>
  )
}
