import { useEffect, useRef, useState } from 'react'
import { useQuery } from '../../shared/api/useQuery'
import { loadRegisteredLeagues } from '../leagues/api'

const MAX_CHECKS = 30
const CHECK_INTERVAL_MS = 2000

export function LeaguePaymentConfirmation({
  fplLeagueId,
  leagueType,
  userId,
  onConfirmed,
  onNavigate,
}: {
  fplLeagueId: number
  leagueType: string
  userId: number
  onConfirmed: (leagueId: number) => void
  onNavigate: (path: string) => void
}) {
  const [attempt, setAttempt] = useState(0)
  const confirmed = useRef(false)
  const query = useQuery(
    `payment:${userId}:${fplLeagueId}:${leagueType}:${attempt}`,
    loadRegisteredLeagues,
  )
  const league = query.data?.find(
    (candidate) =>
      candidate.fplLeagueId === fplLeagueId &&
      candidate.leagueType === leagueType &&
      candidate.ownerUserId === userId &&
      candidate.serviceEnabled,
  )
  const waiting = attempt < MAX_CHECKS - 1 && query.status !== 'error'
  useEffect(() => {
    if (league) {
      if (!confirmed.current) {
        confirmed.current = true
        onConfirmed(league.id)
      }
    } else if (query.status === 'success' && waiting) {
      const timeout = window.setTimeout(() => setAttempt((value) => value + 1), CHECK_INTERVAL_MS)
      return () => window.clearTimeout(timeout)
    }
  }, [league, query.status, waiting, onConfirmed])
  return (
    <section className="league-checkout-page">
      <h1>Confirming your league</h1>
      <p role="status">
        {waiting
          ? 'Waiting for payment confirmation. Your league will open automatically when it is ready.'
          : 'Payment confirmation is taking longer than expected. You can check again or return to your leagues. Please do not pay again.'}
      </p>
      {query.error && <p role="alert">{query.error}</p>}
      {!waiting && (
        <div className="subscription-actions payment-confirmation-actions">
          <button
            type="button"
            onClick={() => {
              setAttempt(0)
              query.refresh()
            }}
          >
            Check again
          </button>
          <button type="button" className="secondary-action" onClick={() => onNavigate('/leagues')}>
            Go to your leagues
          </button>
        </div>
      )}
    </section>
  )
}
