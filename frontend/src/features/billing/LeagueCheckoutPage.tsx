import { ArrowLeft, Check, CircleAlert, CircleCheck } from 'lucide-react'
import { useCallback, useState, type MouseEvent } from 'react'
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
  const normalizedLeagueId = leagueId.trim()
  const hasLeagueId = normalizedLeagueId.length > 0
  const validLeagueId =
    /^\d+$/.test(normalizedLeagueId) &&
    Number.isSafeInteger(Number(normalizedLeagueId)) &&
    Number(normalizedLeagueId) > 0
  const loadPreview = useCallback(
    (signal: AbortSignal) =>
      validLeagueId
        ? previewLeaguePayment(normalizedLeagueId, leagueType, signal)
        : Promise.resolve(null),
    [normalizedLeagueId, validLeagueId, leagueType],
  )
  const previewQuery = useQuery(leagueId + ':' + leagueType, loadPreview)
  const preview = previewQuery.data
  const checkout = useMutation()
  const leagueError =
    hasLeagueId && !validLeagueId
      ? 'Enter a valid, positive FPL league ID.'
      : (previewQuery.error ?? preview?.validationMessage)
  const leagueIsValid = preview?.registrationEligible === true
  const leagueName = !hasLeagueId
    ? 'Enter your league ID'
    : !validLeagueId
      ? 'Check your league ID'
      : previewQuery.status === 'loading'
        ? 'Looking up your league…'
        : (preview?.displayName ?? 'League unavailable')
  const leagueDescription =
    leagueIsValid && preview
      ? `${preview.managerCount} managers · ${leagueType === 'DRAFT' ? 'Draft' : 'Classic'} league`
      : validLeagueId && previewQuery.status === 'loading'
        ? 'Checking FPL data…'
        : 'Check the league ID and choose the matching league type.'
  const canCheckout = leagueIsValid && preview?.checkoutReady && acceptedPolicies && !checkout.busy
  const navigatePolicy = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return
    event.preventDefault()
    onNavigate(event.currentTarget.pathname)
  }
  const openCheckout = async (plan: 'STANDARD' | 'AI_BROADCASTER') => {
    if (!acceptedPolicies || !preview?.checkoutReady || !leagueIsValid) return
    await checkout.run(async (signal) =>
      openPaddleCheckout(
        await createPaddleCheckout(normalizedLeagueId, leagueType, plan, signal),
        signal,
      ),
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
          <div className="checkout-league-summary">
            <span className="checkout-eyebrow">Your league</span>
            <div className="checkout-league-name">
              <strong>{leagueName}</strong>
              {leagueIsValid && (
                <CircleCheck className="league-verified" size={23} aria-label="League verified" />
              )}
              {leagueError && (
                <CircleAlert className="checkout-league-warning" size={23} aria-hidden="true" />
              )}
            </div>
            <span>{leagueDescription}</span>
            {leagueError && (
              <p id="checkout-league-error" className="checkout-league-error" role="alert">
                {leagueError}
              </p>
            )}
            {previewQuery.error && (
              <button type="button" className="checkout-retry" onClick={previewQuery.refresh}>
                Try verification again
              </button>
            )}
          </div>
          <div className="checkout-league-controls">
            <label htmlFor="payment-league-id-professional">FPL league ID</label>
            <div className="checkout-id-field">
              <input
                id="payment-league-id-professional"
                inputMode="numeric"
                aria-invalid={Boolean(leagueError)}
                aria-describedby={leagueError ? 'checkout-league-error' : undefined}
                disabled={checkout.busy}
                value={leagueId}
                onChange={(event) => {
                  checkout.reset()
                  setLeagueId(event.target.value)
                }}
              />
            </div>
            <div className="checkout-league-types" role="group" aria-label="League type">
              <button
                type="button"
                className={leagueType === 'DRAFT' ? 'selected' : ''}
                aria-pressed={leagueType === 'DRAFT'}
                disabled={checkout.busy}
                onClick={() => {
                  checkout.reset()
                  setLeagueType('DRAFT')
                }}
              >
                Draft
              </button>
              <button
                type="button"
                className={leagueType === 'CLASSIC' ? 'selected' : ''}
                aria-pressed={leagueType === 'CLASSIC'}
                disabled={checkout.busy}
                onClick={() => {
                  checkout.reset()
                  setLeagueType('CLASSIC')
                }}
              >
                Classic
              </button>
            </div>
          </div>
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
              disabled={!canCheckout}
            >
              Choose Standard
            </button>
          </article>
          <article className="checkout-plan featured">
            <span className="plan-badge">AI Broadcaster</span>
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
              disabled={!canCheckout}
            >
              Choose AI Broadcaster
            </button>
          </article>
        </section>
      </section>
      {checkout.error && (
        <p className="checkout-notice checkout-payment-error" role="alert">
          {checkout.error}
        </p>
      )}
      {leagueIsValid && !preview?.checkoutReady && (
        <p className="checkout-notice" role="status">
          New league registrations are temporarily unavailable. Please try again later.
        </p>
      )}
      <div className="checkout-consent">
        <input
          id="checkout-policy-consent"
          type="checkbox"
          disabled={checkout.busy}
          checked={acceptedPolicies}
          onChange={(event) => setAcceptedPolicies(event.target.checked)}
        />
        <label htmlFor="checkout-policy-consent">
          By continuing, you agree to our{' '}
          <a href="/terms" onClick={navigatePolicy}>
            Terms of Service
          </a>{' '}
          and acknowledge our{' '}
          <a href="/privacy" onClick={navigatePolicy}>
            Privacy Policy
          </a>
          .
        </label>
      </div>
      <p className="checkout-security">
        Secure payment powered by Paddle · Your card details never reach Fantasy Broadcast · Final
        price and any applicable taxes are shown before you pay
      </p>
    </section>
  )
}
