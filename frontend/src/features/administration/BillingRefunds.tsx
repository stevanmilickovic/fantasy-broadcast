import { useBrowserNavigation } from '../../app/useBrowserNavigation'
import { Pagination } from '../../shared/ui/Pagination'
import { useCallback, useState } from 'react'
import { useMutation } from '../../shared/api/useMutation'
import { useQuery } from '../../shared/api/useQuery'
import { billingDate, formatMoney, parseMoney, planName } from '../billing/billingFormat'
import {
  loadBillingSubscriptions,
  loadSubscriptionPayments,
  submitRefund,
} from '../billing/subscriptionApi'
import type { AdminSubscription, Payment } from '../billing/types'

export function BillingRefunds() {
  const { location, navigate } = useBrowserNavigation()
  const params = new URLSearchParams(location.search)
  const search = params.get('subscriptionSearch') ?? ''
  const requestedPage = Number(params.get('subscriptionPage') ?? 0)
  const page = Number.isSafeInteger(requestedPage) && requestedPage >= 0 ? requestedPage : 0
  const changePage = (nextPage: number, term = search) => {
    const next = new URLSearchParams(location.search)
    next.set('subscriptionPage', String(nextPage))
    next.set('subscriptionSearch', term)
    setSelected(null)
    navigate(`${location.pathname}?${next}`)
  }
  const [selected, setSelected] = useState<AdminSubscription | null>(null)
  const load = useCallback(
    (signal: AbortSignal) => loadBillingSubscriptions(search, page, signal),
    [search, page],
  )
  const query = useQuery(`billing:${search}:${page}`, load)
  return (
    <section
      className="league-discovery admin-registry billing-administration"
      aria-label="Subscriptions and refunds"
    >
      <div className="discovery-form">
        <div>
          <span className="kicker">Billing</span>
          <h2>Subscriptions &amp; refunds</h2>
          <p>Find a payment, review eligibility and submit a refund through Paddle.</p>
        </div>
        <form
          className="billing-search"
          onSubmit={(event) => {
            event.preventDefault()
            const term = String(new FormData(event.currentTarget).get('search') ?? '').trim()
            changePage(0, term)
            if (page === 0 && search === term) query.refresh()
          }}
        >
          <label htmlFor="billing-search">
            League, FPL ID, owner username or payment/subscription ID
          </label>
          <input
            id="billing-search"
            key={search}
            name="search"
            defaultValue={search}
            maxLength={160}
          />
          <button type="submit">Find subscriptions</button>
        </form>
      </div>
      {query.status === 'loading' && <p role="status">Loading subscriptions…</p>}
      {query.error && (
        <p role="alert" className="discovery-error">
          {query.error} <button onClick={query.refresh}>Retry</button>
        </p>
      )}
      {query.data?.items.length === 0 && (
        <p className="empty-text">
          No matching subscriptions. Existing Paddle purchases are imported during billing
          reconciliation.
        </p>
      )}
      {query.data && query.data.items.length > 0 && (
        <div className="billing-subscriptions">
          {query.data.items.map((subscription) => (
            <button
              key={subscription.id}
              aria-pressed={selected?.id === subscription.id}
              onClick={() => setSelected(subscription)}
            >
              <strong>{subscription.leagueName}</strong>
              <span>{subscription.ownerName}</span>
              <small>
                {planName(subscription.plan)} · {subscription.status} · Paid through{' '}
                {billingDate(subscription.periodEnd)}
              </small>
            </button>
          ))}
        </div>
      )}
      {query.data && (
        <Pagination
          page={page}
          totalItems={query.data.totalItems}
          size={query.data.size}
          label="Subscription pages"
          busy={false}
          onPageChange={changePage}
        />
      )}
      {selected && query.data?.items.some((item) => item.id === selected.id) && (
        <RefundPayments key={selected.id} subscription={selected} />
      )}
    </section>
  )
}

function RefundPayments({ subscription }: { subscription: AdminSubscription }) {
  const load = useCallback(
    (signal: AbortSignal) => loadSubscriptionPayments(subscription.id, signal),
    [subscription.id],
  )
  const query = useQuery(subscription.id, load)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const selected = query.data?.find((payment) => payment.id === selectedId)
  return (
    <div className="billing-payments">
      <header>
        <div>
          <h3>{subscription.leagueName}</h3>
          <p>{subscription.ownerName}</p>
          <small>{subscription.id}</small>
        </div>
        <button className="secondary-action" onClick={query.refresh}>
          Refresh payments &amp; refunds
        </button>
      </header>
      <p>
        Amounts include tax. The 14-day indicator concerns the initial purchase; it does not decide
        statutory or service-related refund claims.
      </p>
      {message && (
        <p role="status" className="billing-notice">
          {message}
        </p>
      )}
      {query.status === 'loading' && <p role="status">Checking Paddle payments and refunds…</p>}
      {query.error && <p role="alert">{query.error}</p>}
      {query.data?.length === 0 && <p>No completed payments found.</p>}
      {query.data?.map((payment) => (
        <article key={payment.id} className="billing-payment">
          <div>
            <strong>{formatMoney(payment.total, payment.currencyCode)}</strong>
            <span>
              {billingDate(payment.paidAt)} ·{' '}
              {payment.initialPurchase ? 'Initial purchase' : 'Renewal or plan change'}
            </span>
            <small>{payment.id}</small>
          </div>
          <p>
            {payment.withinRefundWindow
              ? 'Within the initial 14-day refund window'
              : payment.initialPurchase
                ? 'Outside the initial 14-day window — review the reason'
                : 'Review the reason for this payment refund'}
          </p>
          <p>
            Remaining refundable balance:{' '}
            <strong>{formatMoney(payment.refundable, payment.currencyCode)}</strong>
          </p>
          {payment.refunds.length > 0 && (
            <ul>
              {payment.refunds.map((refund) => (
                <li key={refund.id}>
                  <strong>{formatMoney(refund.amount, payment.currencyCode)}</strong> ·{' '}
                  {refund.status === 'pending_approval'
                    ? 'Awaiting Paddle approval'
                    : refund.status}{' '}
                  · {refund.reason}
                  <small>{refund.id}</small>
                </li>
              ))}
            </ul>
          )}
          {payment.awaitingConfirmation && (
            <p role="status">
              A refund request is awaiting confirmation. Refresh to reconcile it before submitting
              another. If it remains pending, check Paddle before taking any further action.
            </p>
          )}
          <button
            disabled={
              payment.refundable <= 0 ||
              payment.awaitingConfirmation ||
              payment.refunds.some((refund) => refund.status === 'pending_approval')
            }
            onClick={() => setSelectedId(payment.id)}
          >
            Review refund
          </button>
        </article>
      ))}
      {selected && (
        <RefundForm
          key={selected.id}
          payment={selected}
          subscription={subscription}
          onClose={() => setSelectedId(null)}
          onSubmitted={(status) => {
            setSelectedId(null)
            setMessage(
              status === 'pending_approval'
                ? 'Refund submitted. Paddle approval is pending; the customer has not been marked as refunded.'
                : status === 'approved'
                  ? 'Refund approved by Paddle. The payment and access status will synchronize automatically.'
                  : `Paddle refund status: ${status}. Review the payment before taking further action.`,
            )
            query.refresh()
          }}
        />
      )}
    </div>
  )
}

function RefundForm({
  payment,
  subscription,
  onClose,
  onSubmitted,
}: {
  payment: Payment
  subscription: AdminSubscription
  onClose: () => void
  onSubmitted: (status: string) => void
}) {
  const [mode, setMode] = useState<'full' | 'partial'>('full')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [endsAccess, setEndsAccess] = useState(
    payment.initialPurchase && payment.withinRefundWindow,
  )
  const [review, setReview] = useState<{ requestId: string } | null>(null)
  const mutation = useMutation()
  const partial = mode === 'partial' ? parseMoney(amount, payment.currencyCode) : null
  const valid =
    reason.trim().length >= 5 &&
    (mode === 'full' || (partial !== null && partial <= payment.refundable))
  const submit = async () => {
    if (!review || !valid) return
    const result = await mutation.run((signal) =>
      submitRefund(
        subscription.id,
        {
          transactionId: payment.id,
          requestId: review.requestId,
          partialAmount: partial,
          reason: reason.trim(),
          endsAccess,
        },
        signal,
      ),
    )
    if (result) onSubmitted(result.data.status)
  }
  return (
    <section className="billing-refund-form" aria-label="Review refund">
      <h3>Refund {subscription.leagueName}</h3>
      <p>
        {payment.id} · {subscription.ownerName}
      </p>
      {!review ? (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (valid) setReview({ requestId: crypto.randomUUID() })
          }}
        >
          <label>
            Refund amount
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value === 'partial' ? 'partial' : 'full')}
            >
              <option value="full">
                Full remaining balance — {formatMoney(payment.refundable, payment.currencyCode)}
              </option>
              <option value="partial">Partial amount</option>
            </select>
          </label>
          {mode === 'partial' && (
            <label>
              Amount in {payment.currencyCode}, including tax
              <input
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
                placeholder="5.00"
              />
            </label>
          )}
          <label>
            Reason
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={5}
              maxLength={700}
              required
              placeholder="Initial purchase refund requested by email…"
            />
          </label>
          <label className="billing-checkbox">
            <input
              type="checkbox"
              checked={endsAccess}
              onChange={(event) => setEndsAccess(event.target.checked)}
            />
            End this subscription and its paid access when the refund is approved
          </label>
          <div className="subscription-actions">
            <button type="submit" disabled={!valid}>
              Review before submitting
            </button>
            <button type="button" className="secondary-action" onClick={onClose}>
              Go back
            </button>
          </div>
        </form>
      ) : (
        <div className="billing-confirmation">
          <h4>Confirm refund</h4>
          <p>
            Refund{' '}
            <strong>{formatMoney(partial ?? payment.refundable, payment.currencyCode)}</strong> to
            the original payment method for <strong>{subscription.ownerName}</strong>.
          </p>
          <p>{reason}</p>
          <p>
            {endsAccess
              ? 'Paid access and the subscription will end after approval.'
              : 'The subscription and paid access will continue.'}
          </p>
          <p>
            Paddle may need to approve this refund. Submitting the request does not mean the money
            has reached the customer.
          </p>
          <div className="subscription-actions">
            <button disabled={mutation.busy} onClick={() => void submit()}>
              {mutation.busy ? 'Submitting…' : 'Submit refund to Paddle'}
            </button>
            <button
              className="secondary-action"
              disabled={mutation.busy}
              onClick={() => setReview(null)}
            >
              Edit request
            </button>
          </div>
        </div>
      )}
      {mutation.error && <p role="alert">{mutation.error}</p>}
    </section>
  )
}
