import { ChevronDown, CreditCard } from 'lucide-react'
import { useCallback, useState } from 'react'
import type { Navigate } from '../../app/useBrowserNavigation'
import { useMutation } from '../../shared/api/useMutation'
import { useQuery } from '../../shared/api/useQuery'
import type { RegisteredLeague } from '../leagues/types'
import { billingDate, formatMoney, planName } from './billingFormat'
import {
  cancelSubscription,
  changePlan,
  loadSubscription,
  openBillingPortal,
  previewPlan,
} from './subscriptionApi'
import { usePlanAvailability } from './usePlanAvailability'
import type { PlanPreview, Subscription } from './types'

type SubscriptionLeague = Pick<
  RegisteredLeague,
  'id' | 'displayName' | 'fplLeagueId' | 'leagueType'
>

export function LeagueSubscriptionSettings({
  league,
  navigate,
  onChanged,
  collapsible = false,
}: {
  league: SubscriptionLeague
  navigate: Navigate
  onChanged?: () => void
  collapsible?: boolean
}) {
  const load = useCallback(
    (signal: AbortSignal) => loadSubscription(league.id, signal),
    [league.id],
  )
  const query = useQuery(`subscription:${league.id}`, load)
  const content = (
    <>
      {query.status === 'loading' && <p role="status">Loading subscription…</p>}
      {query.error && (
        <p role="alert">
          {query.error} <button onClick={query.refresh}>Retry</button>
        </p>
      )}
      {query.data && (
        <SubscriptionDetails
          key={`${query.data.plan}:${query.data.renewalPlan}:${query.data.cancelAt}:${query.data.status}`}
          league={league}
          subscription={query.data}
          refresh={() => {
            query.refresh()
            onChanged?.()
          }}
          navigate={navigate}
        />
      )}
    </>
  )
  return collapsible ? (
    <details className="league-management-disclosure">
      <summary>
        Subscription
        {query.data && (
          <small>{query.data.linked ? planName(query.data.plan) : 'No linked subscription'}</small>
        )}
        <ChevronDown size={16} aria-hidden="true" />
      </summary>
      <section className="league-subscription-settings" aria-label="Subscription details">
        {content}
      </section>
    </details>
  ) : (
    <section className="league-subscription-settings" aria-label="Subscription">
      <h2>Subscription</h2>
      <p>Manage your plan, payments and renewal.</p>
      {content}
    </section>
  )
}

function SubscriptionDetails({
  league,
  subscription,
  refresh,
  navigate,
}: {
  league: SubscriptionLeague
  subscription: Subscription
  refresh: () => void
  navigate: Navigate
}) {
  const { aiBroadcasterEnabled, notice } = usePlanAvailability()
  const mutation = useMutation()
  const [preview, setPreview] = useState<{ value: PlanPreview; requestId: string } | null>(null)
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null)
  const pendingDowngrade = subscription.plan !== subscription.renewalPlan
  const blocked = mutation.busy || subscription.awaitingConfirmation
  const getPreview = async () => {
    const target = subscription.renewalPlan === 'AI_BROADCASTER' ? 'STANDARD' : 'AI_BROADCASTER'
    const result = await mutation.run((signal) => previewPlan(league.id, target, signal))
    if (result) {
      setPreview({ value: result.data, requestId: crypto.randomUUID() })
      setConfirmCancel(null)
    }
  }
  const applyPlan = async () => {
    if (!preview) return
    if (
      await mutation.run((signal) =>
        changePlan(league.id, preview.value, preview.requestId, signal),
      )
    )
      refresh()
  }
  const applyCancellation = async () => {
    if (!confirmCancel) return
    if (
      await mutation.run((signal) =>
        cancelSubscription(league.id, Boolean(subscription.cancelAt), confirmCancel, signal),
      )
    )
      refresh()
  }
  const portal = async () => {
    const result = await mutation.run((signal) => openBillingPortal(league.id, signal))
    if (result) window.location.assign(result.data.url)
  }
  const subject = encodeURIComponent(`Refund request — ${league.displayName}`)
  const body = encodeURIComponent(
    `League: ${league.displayName} (${league.id})\nSubscription: ${subscription.subscriptionId ?? 'Not linked'}\nAccount email:\nPaddle transaction reference:\nReason for refund:\n`,
  )
  return (
    <div className="subscription-grid">
      <article className="subscription-card">
        <CreditCard size={25} aria-hidden="true" />
        <h2>{subscription.linked ? planName(subscription.plan) : 'No linked subscription'}</h2>
        {!subscription.linked ? (
          <p>
            This league has no Paddle subscription linked yet. Contact support if you have already
            paid.
          </p>
        ) : (
          <>
            <p>
              {subscription.accessActive ? 'Paid features available' : 'Paid features inactive'} ·{' '}
              {subscription.status?.replaceAll('_', ' ')}
            </p>
            {subscription.renewalTotal &&
              subscription.currencyCode &&
              !subscription.cancelAt &&
              subscription.status === 'active' && (
                <p>
                  Monthly renewal:{' '}
                  <strong>
                    {formatMoney(subscription.renewalTotal, subscription.currencyCode)}
                  </strong>{' '}
                  · {planName(subscription.renewalPlan)}
                </p>
              )}
            <p>
              {subscription.cancelAt ? 'Access ends' : 'Current access through'}{' '}
              <strong>{billingDate(subscription.cancelAt ?? subscription.accessUntil)}</strong>
            </p>
            {pendingDowngrade && (
              <p className="billing-notice">
                Downgrading to {planName(subscription.renewalPlan)} on{' '}
                {billingDate(subscription.accessUntil)}. AI remains available until then.
              </p>
            )}
            {subscription.cancelAt && (
              <p className="billing-notice">Renewal is cancelled. You will not be charged again.</p>
            )}
            {subscription.status === 'past_due' && (
              <p role="status" className="billing-notice">
                Your payment failed. Update your payment method to keep access. A three-day grace
                period applies after the last paid period.
              </p>
            )}
            {subscription.awaitingConfirmation && (
              <p role="status" className="billing-notice">
                A billing request is awaiting confirmation. Refresh before making another change.
                Contact support if it remains pending.
              </p>
            )}
            {notice && (
              <p className="billing-notice" role="status">
                {notice}
              </p>
            )}
            <div className="subscription-actions">
              {subscription.status === 'active' &&
                !subscription.cancelAt &&
                (subscription.renewalPlan === 'AI_BROADCASTER' || aiBroadcasterEnabled) && (
                  <button disabled={blocked} onClick={() => void getPreview()}>
                    {pendingDowngrade
                      ? 'Keep AI Broadcaster'
                      : subscription.plan === 'STANDARD'
                        ? 'Upgrade to AI'
                        : 'Downgrade to Standard'}
                  </button>
                )}
              {['active', 'past_due'].includes(subscription.status ?? '') && (
                <button
                  className="secondary-action"
                  disabled={blocked}
                  onClick={() => {
                    setConfirmCancel(crypto.randomUUID())
                    setPreview(null)
                  }}
                >
                  {subscription.cancelAt ? 'Keep subscription' : 'Cancel subscription'}
                </button>
              )}
              <button
                className="secondary-action"
                disabled={mutation.busy}
                onClick={() => void portal()}
              >
                Payment details &amp; invoices
              </button>
              {subscription.status === 'canceled' && (
                <button
                  onClick={() =>
                    navigate(
                      `/leagues/checkout?fplLeagueId=${league.fplLeagueId}&leagueType=${league.leagueType}`,
                    )
                  }
                >
                  Subscribe again
                </button>
              )}
            </div>
            {preview && (
              <section className="billing-confirmation" aria-label="Confirm plan change">
                <h3>{planName(preview.value.target)}</h3>
                <p>
                  {preview.value.immediate
                    ? 'Starts immediately after successful payment.'
                    : `Effective ${billingDate(preview.value.effectiveAt)}.`}
                </p>
                <p>
                  Charge now:{' '}
                  <strong>
                    {formatMoney(preview.value.chargeNow, preview.value.currencyCode)}
                  </strong>
                </p>
                {preview.value.renewalTotal && (
                  <p>
                    Next monthly price:{' '}
                    <strong>
                      {formatMoney(preview.value.renewalTotal, preview.value.currencyCode)}
                    </strong>
                  </p>
                )}
                <p>Your billing date stays the same.</p>
                <div className="subscription-actions">
                  <button disabled={blocked} onClick={() => void applyPlan()}>
                    {mutation.busy ? 'Updating…' : 'Confirm plan change'}
                  </button>
                  <button
                    className="secondary-action"
                    disabled={mutation.busy}
                    onClick={() => setPreview(null)}
                  >
                    Go back
                  </button>
                </div>
              </section>
            )}
            {confirmCancel && (
              <section className="billing-confirmation" aria-label="Confirm cancellation">
                <h3>{subscription.cancelAt ? 'Keep your subscription?' : 'Cancel renewal?'}</h3>
                <p>
                  {subscription.cancelAt
                    ? 'Your subscription will renew automatically again, at its current renewal plan.'
                    : `Your paid features remain available until ${billingDate(subscription.accessUntil)}. Cancelling does not issue a refund.`}
                </p>
                <div className="subscription-actions">
                  <button disabled={blocked} onClick={() => void applyCancellation()}>
                    {mutation.busy
                      ? 'Updating…'
                      : subscription.cancelAt
                        ? 'Confirm keep subscription'
                        : 'Confirm cancellation'}
                  </button>
                  <button
                    className="secondary-action"
                    disabled={mutation.busy}
                    onClick={() => setConfirmCancel(null)}
                  >
                    Go back
                  </button>
                </div>
              </section>
            )}
          </>
        )}
        {mutation.error && <p role="alert">{mutation.error}</p>}
        <button className="billing-refresh" disabled={mutation.busy} onClick={refresh}>
          Refresh subscription status
        </button>
      </article>
      <article className="subscription-card subscription-refunds">
        <span className="kicker">Need help?</span>
        <h2>Refund requests</h2>
        <p>
          Our initial-purchase refund policy covers requests made within 14 calendar days. Requests
          are reviewed by a person and refunds are processed through Paddle.
        </p>
        {subscription.refundUntil && (
          <p>
            Initial refund request deadline:{' '}
            <strong>{billingDate(subscription.refundUntil)}</strong>
          </p>
        )}
        <p>
          Include your account email and payment reference. An upgrade does not restart the
          initial-purchase refund window. Applicable consumer rights still apply.
        </p>
        <a
          className="billing-contact"
          href={`mailto:fantasybroadcastapp@gmail.com?subject=${subject}&body=${body}`}
        >
          Email a refund request
        </a>
        <button className="billing-refresh" onClick={() => navigate('/refunds')}>
          Read refund policy
        </button>
      </article>
    </div>
  )
}
