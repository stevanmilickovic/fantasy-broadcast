import { ArrowLeft, Check, CircleCheck } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useMutation } from '../../shared/api/useMutation'
import { useQuery } from '../../shared/api/useQuery'
import type { FplLeagueType } from '../../shared/fpl/types'
import { createPaddleCheckout, previewLeaguePayment } from '../billing/api'
import { openPaddleCheckout } from '../billing/paddleCheckout'
import { MAX_BROADCAST_VIEWERS } from '../broadcast/broadcastLimits'
export function LeagueCheckoutPage({
  search,
  onNavigate,
}: {
  search: string
  onNavigate: (path: string) => void
}) {
  const parameters = new URLSearchParams(search)
  const [leagueId, setLeagueId] = useState(parameters.get('fplLeagueId') ?? '')
  const [leagueType, setLeagueType] = useState<FplLeagueType>(
    parameters.get('leagueType') === 'CLASSIC' ? 'CLASSIC' : 'DRAFT',
  )
  const [acceptedPolicies, setAcceptedPolicies] = useState(false)
  const loadPreview = useCallback(
    (signal: AbortSignal) =>
      leagueId.trim()
        ? previewLeaguePayment(leagueId.trim(), leagueType, signal)
        : Promise.resolve(null),
    [leagueId, leagueType],
  )
  const previewQuery = useQuery(leagueId + ':' + leagueType, loadPreview)
  const preview = previewQuery.data
  const checkout = useMutation()
  const error = checkout.error ?? previewQuery.error ?? preview?.validationMessage
  const leagueIsValid = preview?.registrationEligible === true
  const openCheckout = async (plan: 'STANDARD' | 'AI_BROADCASTER') => {
    if (!acceptedPolicies || !preview?.checkoutReady || !leagueIsValid) return
    await checkout.run(async (signal) =>
      openPaddleCheckout(await createPaddleCheckout(leagueId, leagueType, plan, signal)),
    )
  }
  return (
    <section className="league-checkout-page">
      <button type="button" className="checkout-back" onClick={() => onNavigate('/leagues/new')}>
        <ArrowLeft size={17} /> Back to league ID
      </button>
      <header className="checkout-heading">
        <span className="kicker">Fantasy Broadcast</span>
        <h1>Bring your league to the broadcast.</h1>
        <p>
          Choose a monthly plan for this league. Both plans include up to {MAX_BROADCAST_VIEWERS}{' '}
          simultaneous broadcast viewers per league. Each open broadcast tab or device counts as one
          viewer.
        </p>
      </header>
      <section className="checkout-layout">
        <aside className="checkout-league-card">
          <div>
            <span className="checkout-eyebrow">Your league</span>
            <strong>
              {preview?.displayName ?? 'Looking up your league…'}
              {leagueIsValid && (
                <CircleCheck className="league-verified" size={23} aria-label="League verified" />
              )}
            </strong>
            <span>
              {preview
                ? `${preview.managerCount} managers · ${leagueType === 'DRAFT' ? 'Draft' : 'Classic'} league`
                : 'Checking FPL data'}
            </span>
          </div>
          <div className="checkout-league-controls">
            <label htmlFor="payment-league-id-professional">FPL league ID</label>
            <div className="checkout-id-field">
              <input
                id="payment-league-id-professional"
                inputMode="numeric"
                value={leagueId}
                onChange={(event) => setLeagueId(event.target.value)}
              />
            </div>
            <div className="checkout-league-types" role="radiogroup">
              <button
                type="button"
                className={leagueType === 'DRAFT' ? 'selected' : ''}
                onClick={() => setLeagueType('DRAFT')}
              >
                Draft
              </button>
              <button
                type="button"
                className={leagueType === 'CLASSIC' ? 'selected' : ''}
                onClick={() => setLeagueType('CLASSIC')}
              >
                Classic
              </button>
            </div>
          </div>
          {error && <p className="discovery-error">{error}</p>}
        </aside>
        <section className="checkout-plans" aria-label="Broadcast plans">
          <article className="checkout-plan">
            <span>Standard</span>
            <h2>€4.99</h2>
            <p>Per league, per month · Renews monthly during the season</p>
            <ul>
              <li>
                <Check size={16} /> Live matchday broadcast
              </li>
              <li>
                <Check size={16} /> Up to {MAX_BROADCAST_VIEWERS} simultaneous viewers
              </li>
              <li>
                <Check size={16} /> League standings and teams
              </li>
            </ul>
            <button
              type="button"
              onClick={() => void openCheckout('STANDARD')}
              disabled={
                !leagueIsValid || !preview?.checkoutReady || !acceptedPolicies || checkout.busy
              }
            >
              Choose Standard
            </button>
          </article>
          <article className="checkout-plan featured">
            <span className="plan-badge">AI Commentator</span>
            <h2>€14.99</h2>
            <p>Per league, per month · Renews monthly during the season</p>
            <ul>
              <li>
                <Check size={16} /> Live matchday broadcast
              </li>
              <li>
                <Check size={16} /> Up to {MAX_BROADCAST_VIEWERS} simultaneous viewers
              </li>
              <li>
                <Check size={16} /> League standings and teams
              </li>
              <li>
                <Check size={16} /> AI voice commentary
              </li>
            </ul>
            <button
              type="button"
              onClick={() => void openCheckout('AI_BROADCASTER')}
              disabled={
                !leagueIsValid || !preview?.checkoutReady || !acceptedPolicies || checkout.busy
              }
            >
              Choose AI Broadcaster
            </button>
          </article>
        </section>
      </section>
      {preview && !preview.checkoutReady && (
        <p className="checkout-notice">
          Checkout is being prepared. Add the Paddle sandbox credentials and price IDs to enable
          secure payment testing.
        </p>
      )}
      <label className="checkout-consent">
        <input
          type="checkbox"
          checked={acceptedPolicies}
          onChange={(event) => setAcceptedPolicies(event.target.checked)}
        />
        <span>
          By continuing, you agree to our{' '}
          <button type="button" onClick={() => onNavigate('/terms')}>
            Terms of Service
          </button>{' '}
          and acknowledge our{' '}
          <button type="button" onClick={() => onNavigate('/privacy')}>
            Privacy Policy
          </button>
          .
        </span>
      </label>
      <p className="checkout-security">
        Secure payment powered by Paddle · Your card details never reach Fantasy Broadcast · Final
        price and any applicable taxes are shown before you pay
      </p>
    </section>
  )
}
