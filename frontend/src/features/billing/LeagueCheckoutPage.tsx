import { Check, ChevronRight, CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { positiveId } from '../../app/routes'
import type { Navigate } from '../../app/useBrowserNavigation'
import { useMutation } from '../../shared/api/useMutation'
import { useQuery } from '../../shared/api/useQuery'
import type { FplLeagueType } from '../../shared/fpl/types'
import { MAX_BROADCAST_VIEWERS } from '../broadcast/broadcastLimits'
import { TERMS_VERSION } from '../public/policyVersions'
import { createPaddleCheckout, previewLeaguePayment } from './api'
import { planName } from './billingFormat'
import { monthlyPlanPrice } from './billingPlans'
import { openPaddleCheckout } from './paddleCheckout'
import type { BillingPlan } from './types'
import { usePlanAvailability } from './usePlanAvailability'

function revealOnMobile(element: HTMLElement | null) {
  if (!element || !window.matchMedia('(max-width: 700px), (max-height: 500px)').matches) return
  window.requestAnimationFrame(() => {
    if (!element.isConnected) return
    const viewport = window.visualViewport
    const viewportBottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight
    const distance = element.getBoundingClientRect().bottom - viewportBottom
    if (distance <= 0) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollBy({ top: distance + 12, behavior: reducedMotion ? 'instant' : 'smooth' })
  })
}

export function LeagueCheckoutPage({
  leagueId: initialLeagueId,
  leagueType: initialLeagueType,
  selectedPlan: initialPlan,
  onNavigate,
}: {
  leagueId: string
  leagueType: FplLeagueType
  selectedPlan: BillingPlan | null
  onNavigate: Navigate
}) {
  const { aiBroadcasterEnabled, checkingAvailability, notice } = usePlanAvailability()
  const [leagueInputValue, setLeagueInputValue] = useState(initialLeagueId)
  const leagueId = leagueInputValue.trim()
  const [leagueType, setLeagueType] = useState(initialLeagueType)
  const [selectedPlan, setSelectedPlan] = useState(initialPlan)
  const [acceptedPolicies, setAcceptedPolicies] = useState(false)
  const [validation, setValidation] = useState<'league' | 'plan' | 'consent' | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<'opening' | 'opened' | 'closed'>('opening')
  const leagueInput = useRef<HTMLInputElement>(null)
  const firstPlanInput = useRef<HTMLInputElement>(null)
  const policyInput = useRef<HTMLInputElement>(null)
  const consentLabel = useRef<HTMLLabelElement>(null)
  const paymentButton = useRef<HTMLButtonElement>(null)
  const checkout = useMutation()

  const [lookupId, setLookupId] = useState(initialLeagueId.trim())
  useEffect(() => {
    if (lookupId === leagueId) return
    const timeout = window.setTimeout(() => setLookupId(leagueId), 400)
    return () => window.clearTimeout(timeout)
  }, [leagueId, lookupId])
  const loadPreview = useCallback(
    (signal: AbortSignal) =>
      positiveId(lookupId)
        ? previewLeaguePayment(lookupId, leagueType, signal)
        : Promise.resolve(null),
    [lookupId, leagueType],
  )
  const previewQuery = useQuery(`${lookupId}:${leagueType}`, loadPreview)
  const validLeagueId = Boolean(positiveId(leagueId))
  const lookupCurrent = lookupId === leagueId
  const checkingLeague = validLeagueId && (!lookupCurrent || previewQuery.status === 'loading')
  const preview = lookupCurrent ? previewQuery.data : undefined
  const leagueError = validLeagueId
    ? lookupCurrent
      ? (previewQuery.error ?? preview?.validationMessage)
      : null
    : validation === 'league' || leagueId
      ? 'Enter a valid, positive FPL league ID.'
      : null
  const verified = preview?.registrationEligible === true
  const selectedAvailable =
    selectedPlan === 'STANDARD' || (selectedPlan === 'AI_BROADCASTER' && aiBroadcasterEnabled)
  const paymentUnavailable = verified && !preview.checkoutReady

  useEffect(() => {
    if (paymentStatus === 'closed' && !checkout.busy) paymentButton.current?.focus()
  }, [checkout.busy, paymentStatus])

  const resetPayment = () => {
    checkout.reset()
    setPaymentStatus('opening')
    setValidation(null)
  }

  const openCheckout = async (event: FormEvent) => {
    event.preventDefault()
    if (checkout.busy || checkingLeague || paymentUnavailable) return
    if (!verified) {
      setValidation('league')
      leagueInput.current?.focus()
      return
    }
    if (!selectedAvailable || !selectedPlan) {
      setValidation('plan')
      firstPlanInput.current?.focus()
      return
    }
    if (!acceptedPolicies) {
      setValidation('consent')
      policyInput.current?.focus()
      return
    }
    setValidation(null)
    setPaymentStatus('opening')
    const result = await checkout.run(async (signal) =>
      openPaddleCheckout(
        await createPaddleCheckout(
          leagueId,
          leagueType,
          selectedPlan,
          { acceptedPolicies, termsVersion: TERMS_VERSION },
          signal,
        ),
        signal,
        () => setPaymentStatus('opened'),
      ),
    )
    if (result?.data.status === 'completed') onNavigate(result.data.successPath, true)
    else if (result?.data.status === 'closed') setPaymentStatus('closed')
  }

  return (
    <section className="league-checkout-page">
      <form className="checkout-review" onSubmit={(event) => void openCheckout(event)} noValidate>
        <section className="checkout-league-panel">
          <h1 id="checkout-league-heading">Register a league</h1>
          <fieldset
            className="checkout-fields"
            aria-labelledby="checkout-league-heading"
            disabled={checkout.busy}
          >
            <div className="checkout-league-fields">
              <label>
                FPL league ID
                <input
                  ref={leagueInput}
                  inputMode="numeric"
                  value={leagueInputValue}
                  required
                  aria-invalid={Boolean(leagueError)}
                  aria-describedby={leagueError ? 'checkout-league-error' : undefined}
                  onChange={(event) => {
                    resetPayment()
                    setLeagueInputValue(event.target.value)
                  }}
                />
              </label>
              <div className="checkout-league-type">
                <span id="checkout-league-type-label">League type</span>
                <div
                  className="checkout-type-options"
                  role="group"
                  aria-labelledby="checkout-league-type-label"
                >
                  {(['DRAFT', 'CLASSIC'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={type === leagueType}
                      onClick={() => {
                        if (type === leagueType) return
                        resetPayment()
                        setLeagueType(type)
                      }}
                    >
                      {type === 'CLASSIC' ? 'Classic' : 'Draft'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="checkout-league-result">
              <div role="status">
                {verified ? (
                  <div className="checkout-league-status" data-state="verified">
                    <CircleCheck size={18} role="img" aria-label="League verified" />
                    <div className="checkout-league-identity">
                      <strong>{preview.displayName}</strong>
                      <span>
                        {leagueType === 'CLASSIC' ? 'Classic' : 'Draft'} · {preview.managerCount}{' '}
                        {preview.managerCount === 1 ? 'manager' : 'managers'}
                      </span>
                    </div>
                  </div>
                ) : checkingLeague ? (
                  <div className="checkout-league-status" data-state="checking">
                    <LoaderCircle size={18} aria-hidden="true" />
                    <p>Verifying league…</p>
                  </div>
                ) : null}
              </div>
              {leagueError && (
                <div className="checkout-league-status" data-state="error">
                  <CircleAlert size={18} aria-hidden="true" />
                  <p id="checkout-league-error" role="alert">
                    {leagueError}
                  </p>
                  {lookupCurrent && previewQuery.error && (
                    <button
                      className="checkout-action"
                      type="button"
                      onClick={() => {
                        leagueInput.current?.focus({ preventScroll: true })
                        previewQuery.refresh()
                      }}
                    >
                      Try league lookup again
                    </button>
                  )}
                </div>
              )}
            </div>
          </fieldset>
        </section>
        <fieldset
          className="checkout-fields checkout-plans"
          disabled={checkout.busy}
          aria-describedby={validation === 'plan' ? 'checkout-plan-error' : undefined}
        >
          <legend>Choose a plan</legend>
          <div className="checkout-plan-options">
            {(['STANDARD', 'AI_BROADCASTER'] as const).map((plan) => {
              const ai = plan === 'AI_BROADCASTER'
              const unavailable = ai && !aiBroadcasterEnabled
              const nameId = `checkout-plan-${plan}-name`
              const detailsId = `checkout-plan-${plan}-details`
              const availabilityId = `checkout-plan-${plan}-availability`
              return (
                <label key={plan} className="checkout-plan" data-plan={plan}>
                  <span className="checkout-plan-header">
                    <strong className="checkout-plan-name" id={nameId}>
                      {planName(plan)}
                    </strong>
                    <input
                      ref={ai ? undefined : firstPlanInput}
                      type="radio"
                      name="plan"
                      value={plan}
                      checked={!unavailable && plan === selectedPlan}
                      disabled={unavailable}
                      aria-labelledby={nameId}
                      aria-describedby={unavailable ? `${detailsId} ${availabilityId}` : detailsId}
                      onClick={(event) => {
                        if (event.detail > 0 && verified && !acceptedPolicies)
                          revealOnMobile(consentLabel.current)
                      }}
                      onChange={() => {
                        resetPayment()
                        setSelectedPlan(plan)
                      }}
                    />
                  </span>
                  <span id={detailsId} className="checkout-plan-details">
                    <span className="checkout-plan-price">
                      <strong>{monthlyPlanPrice[plan]}</strong> <small>per league / month</small>
                    </span>
                    <span className="checkout-plan-benefit">
                      {ai ? (
                        <>
                          Everything in Standard, plus <strong>AI voice commentary.</strong>
                        </>
                      ) : (
                        'Live matchday broadcast, league standings and teams.'
                      )}
                    </span>
                  </span>
                  {unavailable && (
                    <span className="checkout-plan-availability" id={availabilityId}>
                      {checkingAvailability
                        ? 'Checking availability…'
                        : (notice ?? 'Currently unavailable')}
                    </span>
                  )}
                </label>
              )
            })}
          </div>
          <p>
            Both plans include up to {MAX_BROADCAST_VIEWERS} simultaneous viewers. Each open tab or
            device counts as one viewer.
          </p>
          {validation === 'plan' && (
            <p id="checkout-plan-error" role="alert">
              Choose an available plan.
            </p>
          )}
        </fieldset>
        <div className="checkout-consent">
          <label ref={consentLabel}>
            <span className="checkout-checkbox">
              <input
                ref={policyInput}
                type="checkbox"
                required
                disabled={checkout.busy}
                checked={acceptedPolicies}
                aria-invalid={validation === 'consent'}
                aria-describedby={validation === 'consent' ? 'checkout-consent-error' : undefined}
                onClick={(event) => {
                  if (event.detail > 0 && event.currentTarget.checked)
                    revealOnMobile(paymentButton.current)
                }}
                onChange={(event) => {
                  setAcceptedPolicies(event.target.checked)
                  setValidation(null)
                }}
              />
              <Check size={14} strokeWidth={3} aria-hidden="true" />
            </span>
            <span className="checkout-consent-copy">
              I agree to the{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer">
                Terms and Conditions
              </a>{' '}
              and acknowledge the{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </a>
              .
            </span>
          </label>
          {validation === 'consent' && (
            <p id="checkout-consent-error" role="alert">
              Agree to the terms and acknowledge the privacy policy to continue.
            </p>
          )}
        </div>
        <section className="checkout-summary" aria-labelledby="checkout-summary-heading">
          <div className="checkout-summary-copy">
            <h2 id="checkout-summary-heading">Selected plan</h2>
            <div className="checkout-summary-plan" aria-live="polite">
              {selectedAvailable && selectedPlan ? (
                <strong>
                  {planName(selectedPlan)} · {monthlyPlanPrice[selectedPlan]} / month
                </strong>
              ) : (
                <span>Choose a plan</span>
              )}
            </div>
            {selectedAvailable && (
              <p>
                Renews monthly per league during the Premier League season. Cancel to stop the next
                renewal. Checkout shows today’s total, the renewal amount and any tax before you
                pay.
              </p>
            )}
          </div>
          <div className="checkout-summary-action">
            {paymentUnavailable && (
              <p role="status">Payment is temporarily unavailable. Please try again later.</p>
            )}
            {checkout.error && <p role="alert">{checkout.error}</p>}
            {!checkout.busy && paymentStatus === 'closed' && (
              <p role="status">Checkout closed. Your selections have been kept.</p>
            )}
            <button
              ref={paymentButton}
              className="checkout-pay"
              type="submit"
              disabled={checkout.busy || checkingLeague || paymentUnavailable}
            >
              {checkout.busy
                ? paymentStatus === 'opened'
                  ? 'Payment window open'
                  : 'Opening payment…'
                : 'Continue to payment'}
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          </div>
        </section>
      </form>
    </section>
  )
}
