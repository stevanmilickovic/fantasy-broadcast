import { CircleCheck } from 'lucide-react'
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

export function LeagueCheckoutPage({
  leagueId,
  leagueType,
  selectedPlan,
  onNavigate,
}: {
  leagueId: string
  leagueType: FplLeagueType
  selectedPlan: BillingPlan | null
  onNavigate: Navigate
}) {
  const { aiBroadcasterEnabled, checkingAvailability, notice } = usePlanAvailability()
  const [showPlans, setShowPlans] = useState(!selectedPlan)
  const [acceptedPolicies, setAcceptedPolicies] = useState(false)
  const [consentRequired, setConsentRequired] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<'opening' | 'opened' | 'closed'>('opening')
  const policyInput = useRef<HTMLInputElement>(null)
  const paymentButton = useRef<HTMLButtonElement>(null)
  const checkout = useMutation()

  const validLeagueId = Boolean(positiveId(leagueId))
  const loadPreview = useCallback(
    (signal: AbortSignal) =>
      validLeagueId ? previewLeaguePayment(leagueId, leagueType, signal) : Promise.resolve(null),
    [leagueId, leagueType, validLeagueId],
  )
  const previewQuery = useQuery(`${leagueId}:${leagueType}`, loadPreview)
  const preview = previewQuery.data
  const leagueError = !validLeagueId
    ? 'Enter a valid, positive FPL league ID.'
    : (previewQuery.error ?? preview?.validationMessage)
  const verified = preview?.registrationEligible === true
  const selectedAvailable =
    selectedPlan === 'STANDARD' || (selectedPlan === 'AI_BROADCASTER' && aiBroadcasterEnabled)
  const canPay = verified && preview.checkoutReady && selectedAvailable

  useEffect(() => {
    if (paymentStatus === 'closed' && !checkout.busy) paymentButton.current?.focus()
  }, [checkout.busy, paymentStatus])

  const draft = new URLSearchParams({
    ...(leagueId && { fplLeagueId: leagueId }),
    leagueType,
  }).toString()
  const choosePlan = (plan: BillingPlan) => {
    checkout.reset()
    setPaymentStatus('opening')
    onNavigate(`/leagues/checkout?${draft}&plan=${plan}`, true)
  }

  const openCheckout = async (event: FormEvent) => {
    event.preventDefault()
    if (!canPay || !selectedPlan || checkout.busy) return
    if (!acceptedPolicies) {
      setConsentRequired(true)
      policyInput.current?.focus()
      return
    }
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
      <header className="checkout-heading">
        <span className="kicker">Checkout</span>
        <h1>Review your subscription</h1>
      </header>
      <div className="checkout-layout">
        <section className="checkout-league-card" aria-label="Your league">
          <div className="checkout-league-summary">
            <span className="checkout-eyebrow">Your league</span>
            {preview && (
              <>
                <div className="checkout-league-name">
                  <strong>{preview.displayName}</strong>
                  {verified && (
                    <CircleCheck
                      className="league-verified"
                      size={23}
                      aria-label="League verified"
                    />
                  )}
                </div>
                {verified && (
                  <span>
                    {leagueType === 'CLASSIC' ? 'Classic' : 'Draft'} league #{leagueId} ·{' '}
                    {preview.managerCount} managers
                  </span>
                )}
              </>
            )}
            {leagueError && (
              <p className="checkout-league-error" role="alert">
                {leagueError}
              </p>
            )}
            {validLeagueId && previewQuery.status === 'loading' && (
              <p role="status">Verifying league…</p>
            )}
            {previewQuery.error && (
              <button className="checkout-action" type="button" onClick={previewQuery.refresh}>
                Try verification again
              </button>
            )}
          </div>
          <button
            className="checkout-action"
            type="button"
            disabled={checkout.busy}
            onClick={() =>
              onNavigate(`/leagues/new?${draft}${selectedPlan ? `&plan=${selectedPlan}` : ''}`)
            }
          >
            Edit league
          </button>
        </section>
        {verified && (
          <form className="checkout-review" onSubmit={(event) => void openCheckout(event)}>
            {selectedPlan && (
              <div className="checkout-plan-heading">
                <h2>{planName(selectedPlan)}</h2>
                {selectedAvailable && (
                  <button
                    className="checkout-action"
                    type="button"
                    aria-expanded={showPlans}
                    aria-controls={showPlans ? 'checkout-plan-options' : undefined}
                    disabled={checkout.busy}
                    onClick={() => setShowPlans(!showPlans)}
                  >
                    {showPlans ? 'Hide plan options' : 'Change plan'}
                  </button>
                )}
              </div>
            )}
            {(showPlans || !selectedAvailable) && (
              <fieldset
                id="checkout-plan-options"
                className="checkout-plans"
                disabled={checkout.busy}
              >
                <legend>Choose a plan</legend>
                {(['STANDARD', 'AI_BROADCASTER'] as const).map((plan) => {
                  const ai = plan === 'AI_BROADCASTER'
                  return (
                    <label className="checkout-plan" key={plan}>
                      <input
                        type="radio"
                        name="plan"
                        value={plan}
                        checked={plan === selectedPlan}
                        disabled={ai && !aiBroadcasterEnabled}
                        onChange={() => choosePlan(plan)}
                      />
                      <span>
                        <strong>{planName(plan)}</strong>
                        <span>{monthlyPlanPrice[plan]} / month</span>
                        <small>
                          {ai
                            ? checkingAvailability
                              ? 'Checking availability…'
                              : aiBroadcasterEnabled
                                ? 'Includes AI voice commentary'
                                : 'Currently unavailable'
                            : 'Live matchday broadcast'}
                        </small>
                      </span>
                    </label>
                  )
                })}
              </fieldset>
            )}
            {notice && <p role="status">{notice}</p>}
            {selectedAvailable && selectedPlan && (
              <>
                <p>
                  Live matchday broadcast for up to {MAX_BROADCAST_VIEWERS} simultaneous viewers,
                  plus league standings and teams
                  {selectedPlan === 'AI_BROADCASTER' && ' and AI voice commentary'}. Each open
                  broadcast tab or device counts as one viewer.
                </p>
                <dl className="checkout-totals">
                  <div>
                    <dt>Due today (estimated)</dt>
                    <dd>{monthlyPlanPrice[selectedPlan]}</dd>
                  </div>
                  <div>
                    <dt>Monthly renewal (estimated)</dt>
                    <dd>{monthlyPlanPrice[selectedPlan]}</dd>
                  </div>
                </dl>
                <p>Paddle shows the final total and any applicable tax before you pay.</p>
                <p>
                  Renews monthly during the Premier League season. Cancel any time to stop renewal
                  after the current paid period. No off-season renewal is due.
                </p>
              </>
            )}
            {!preview.checkoutReady && (
              <p role="status">
                New league registrations are temporarily unavailable. Please try again later.
              </p>
            )}
            {canPay && (
              <div className="checkout-consent">
                <input
                  ref={policyInput}
                  id="checkout-policy-consent"
                  type="checkbox"
                  disabled={checkout.busy}
                  checked={acceptedPolicies}
                  aria-invalid={consentRequired}
                  aria-describedby={consentRequired ? 'checkout-consent-error' : undefined}
                  onChange={(event) => {
                    setAcceptedPolicies(event.target.checked)
                    setConsentRequired(false)
                  }}
                />
                <label htmlFor="checkout-policy-consent">
                  I agree to the{' '}
                  <a href="/terms" target="_blank" rel="noopener noreferrer">
                    Terms of Service
                  </a>{' '}
                  and acknowledge the{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer">
                    Privacy Policy
                  </a>
                  . Policy links open in a new tab.
                </label>
                {consentRequired && (
                  <p id="checkout-consent-error" role="alert">
                    Accept the terms and acknowledge the privacy policy to continue.
                  </p>
                )}
              </div>
            )}
            <button
              ref={paymentButton}
              className="checkout-pay"
              type="submit"
              disabled={!canPay || checkout.busy}
            >
              Continue to payment
            </button>
            {checkout.error && (
              <p className="checkout-league-error" role="alert">
                {checkout.error}
              </p>
            )}
            {checkout.busy && (
              <p role="status">
                {paymentStatus === 'opened'
                  ? 'Complete or close the secure Paddle window.'
                  : 'Opening secure checkout…'}
              </p>
            )}
            {!checkout.busy && paymentStatus === 'closed' && (
              <p role="status">Checkout closed. Your selections have been kept.</p>
            )}
          </form>
        )}
      </div>
    </section>
  )
}
