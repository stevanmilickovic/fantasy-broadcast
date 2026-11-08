import { ArrowLeft, Check, CircleAlert, CircleCheck } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import { useMutation } from '../../shared/api/useMutation'
import { useQuery } from '../../shared/api/useQuery'
import type { FplLeagueType } from '../../shared/fpl/types'
import { createPaddleCheckout, previewLeaguePayment } from '../billing/api'
import { openPaddleCheckout } from '../billing/paddleCheckout'
import { usePlanAvailability } from './usePlanAvailability'
import { MAX_BROADCAST_VIEWERS } from '../broadcast/broadcastLimits'
import { TERMS_VERSION } from '../public/policyVersions'
import { useNotifications } from '../../shared/ui/notifications'
export function LeagueCheckoutPage({
  search,
  onNavigate,
}: {
  search: string
  onNavigate: (path: string) => void
}) {
  const { aiBroadcasterEnabled, notice } = usePlanAvailability()
  const parameters = new URLSearchParams(search)
  const [selectedPlan, setSelectedPlan] = useState(parameters.get('plan'))
  const [leagueId, setLeagueId] = useState(parameters.get('fplLeagueId') ?? '')
  const [leagueType, setLeagueType] = useState<FplLeagueType>(
    parameters.get('leagueType') === 'CLASSIC' ? 'CLASSIC' : 'DRAFT',
  )
  const [acceptedPolicies, setAcceptedPolicies] = useState(false)
  const [consentRequired, setConsentRequired] = useState(false)
  const [attemptedCheckout, setAttemptedCheckout] = useState(false)
  const [paddleOpened, setPaddleOpened] = useState(false)
  const policyInput = useRef<HTMLInputElement>(null)
  const leagueInput = useRef<HTMLInputElement>(null)
  const [focusTarget, setFocusTarget] = useState<{ element: HTMLElement | null } | null>(null)
  const checkout = useMutation()
  const { notify } = useNotifications()
  useEffect(() => {
    if (!focusTarget || checkout.busy) return
    const frame = window.requestAnimationFrame(() => {
      focusTarget.element?.scrollIntoView({ block: 'center' })
      focusTarget.element?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [focusTarget, checkout.busy])
  const focusPrerequisite = (element: HTMLElement | null) => setFocusTarget({ element })
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
  const leagueError =
    (hasLeagueId || attemptedCheckout) && !validLeagueId
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
  const navigatePolicy = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return
    event.preventDefault()
    onNavigate(event.currentTarget.pathname)
  }
  const openCheckout = async (plan: 'STANDARD' | 'AI_BROADCASTER', trigger: HTMLElement) => {
    if (plan === 'AI_BROADCASTER' && !aiBroadcasterEnabled) return
    if (checkout.busy) return
    setSelectedPlan(plan)
    setAttemptedCheckout(true)
    if (!leagueIsValid) {
      notify(
        previewQuery.status === 'loading'
          ? 'League details are still loading. Please try again shortly.'
          : 'Check your league ID and league type to continue.',
      )
      if (previewQuery.status !== 'loading') focusPrerequisite(leagueInput.current)
      return
    }
    if (!preview?.checkoutReady) {
      notify('New league registrations are temporarily unavailable. Please try again later.')
      return
    }
    if (!acceptedPolicies) {
      setConsentRequired(true)
      notify('Please accept the terms to continue.', { id: 'checkout-consent' })
      focusPrerequisite(policyInput.current)
      return
    }
    setFocusTarget(null)
    setPaddleOpened(false)
    const result = await checkout.run(async (signal) =>
      openPaddleCheckout(
        await createPaddleCheckout(
          normalizedLeagueId,
          leagueType,
          plan,
          { acceptedPolicies, termsVersion: TERMS_VERSION },
          signal,
        ),
        signal,
        () => setPaddleOpened(true),
      ),
    )
    if (result?.data?.status === 'completed') onNavigate(result.data.successPath)
    else if (result?.data?.status === 'closed') {
      notify('Checkout closed. Your selections have been kept.')
      focusPrerequisite(trigger)
    }
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
          Choose a monthly plan for this league. Each plan includes up to {MAX_BROADCAST_VIEWERS}{' '}
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
                ref={leagueInput}
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
          <article className="checkout-plan" data-selected={selectedPlan === 'STANDARD'}>
            <span>Standard</span>
            {selectedPlan === 'STANDARD' && (
              <small className="checkout-selected-plan">Selected plan</small>
            )}
            <h2>€6.99</h2>
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
              onClick={(event) => void openCheckout('STANDARD', event.currentTarget)}
              disabled={checkout.busy}
            >
              Choose Standard
            </button>
          </article>
          <article
            className="checkout-plan featured"
            data-selected={selectedPlan === 'AI_BROADCASTER'}
            aria-disabled={!aiBroadcasterEnabled}
          >
            <span className="plan-badge">AI Broadcaster</span>
            {selectedPlan === 'AI_BROADCASTER' && (
              <small className="checkout-selected-plan">Selected plan</small>
            )}
            <h2>€19.99</h2>
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
              onClick={(event) => void openCheckout('AI_BROADCASTER', event.currentTarget)}
              disabled={checkout.busy || !aiBroadcasterEnabled}
            >
              {aiBroadcasterEnabled ? 'Choose AI Broadcaster' : 'Currently unavailable'}
            </button>
          </article>
        </section>
      </section>
      {notice && (
        <p className="checkout-notice" role="status">
          {notice}
        </p>
      )}
      {checkout.error && (
        <p className="checkout-notice checkout-payment-error" role="alert">
          {checkout.error}
        </p>
      )}
      {checkout.busy && (
        <p className="checkout-notice" role="status">
          {paddleOpened
            ? 'Complete or close the secure Paddle window to return to these plans.'
            : 'Opening secure checkout…'}
        </p>
      )}
      {leagueIsValid && !preview?.checkoutReady && (
        <p className="checkout-notice" role="status">
          New league registrations are temporarily unavailable. Please try again later.
        </p>
      )}
      <div className="checkout-consent" data-required={consentRequired && !acceptedPolicies}>
        <input
          ref={policyInput}
          id="checkout-policy-consent"
          type="checkbox"
          disabled={checkout.busy}
          checked={acceptedPolicies}
          aria-invalid={consentRequired && !acceptedPolicies}
          aria-describedby={
            consentRequired && !acceptedPolicies ? 'checkout-consent-error' : undefined
          }
          onChange={(event) => {
            setAcceptedPolicies(event.target.checked)
            setConsentRequired(false)
          }}
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
        {consentRequired && !acceptedPolicies && (
          <p id="checkout-consent-error">
            Accept the Terms of Service and acknowledge the Privacy Policy before paying.
          </p>
        )}
      </div>
      <p className="checkout-security">
        Secure payment powered by Paddle · Your card details never reach Fantasy Broadcast · Final
        price and any applicable taxes are shown before you pay
      </p>
    </section>
  )
}
