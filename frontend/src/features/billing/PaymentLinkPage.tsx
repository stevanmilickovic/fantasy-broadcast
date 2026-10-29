import { CreditCard } from 'lucide-react'
import type { Navigate } from '../../app/useBrowserNavigation'
import { useQuery } from '../../shared/api/useQuery'
import { LegalFooter } from '../../shared/ui/LegalFooter'
import { PublicHeader } from '../../shared/ui/PublicHeader'
import { loadPaymentConfiguration } from './api'
import { usePaymentLink } from './usePaymentLink'

export function PaymentLinkPage({ search, navigate }: { search: string; navigate: Navigate }) {
  const transactions = new URLSearchParams(search).getAll('_ptxn')
  const valid = transactions.length === 1 && /^txn_[a-z0-9]{26}$/.test(transactions[0])
  return (
    <main className="public-page payment-link-page">
      <PublicHeader onNavigate={navigate} />
      <section className="public-content payment-link-content">
        <CreditCard size={30} aria-hidden="true" />
        <h1>Secure payment</h1>
        {valid ? (
          <PaymentLinkCheckout key={search} />
        ) : (
          <>
            <p role={transactions.length ? 'alert' : undefined}>
              {transactions.length
                ? 'This payment link is invalid.'
                : 'Open the complete payment link from your Paddle email to continue.'}
            </p>
            <p>You can also manage your subscription and payments from your league page.</p>
            <button type="button" onClick={() => navigate('/leagues')}>
              Go to your account
            </button>
          </>
        )}
      </section>
      <LegalFooter onNavigate={navigate} className="public-footer" />
    </main>
  )
}

function PaymentLinkCheckout() {
  const query = useQuery('payment-configuration', loadPaymentConfiguration)
  if (query.status === 'loading') return <p role="status">Preparing secure checkout…</p>
  if (query.error)
    return (
      <>
        <p role="alert">{query.error}</p>
        <button type="button" onClick={query.refresh}>
          Try again
        </button>
      </>
    )
  if (query.data) return <PaymentLinkStatus clientSideToken={query.data.clientSideToken} />
}

function PaymentLinkStatus({ clientSideToken }: { clientSideToken: string }) {
  const state = usePaymentLink(clientSideToken)
  const messages = {
    loading: 'Loading secure checkout…',
    ready: 'Your secure checkout will open automatically.',
    opened: 'Complete your payment or payment-detail update in the secure Paddle window.',
    closed: 'Checkout closed. You can reopen this link whenever you are ready.',
    completed:
      'All set. Paddle has completed this checkout. Any paid subscription changes will appear once payment confirmation is received.',
  }
  return (
    <>
      {state.status === 'error' ? (
        <p role="alert">{state.error}</p>
      ) : (
        <p role="status">{messages[state.status]}</p>
      )}
      {['error', 'closed', 'ready'].includes(state.status) && (
        <button type="button" onClick={() => window.location.reload()}>
          {state.status === 'error' ? 'Try again' : 'Reopen checkout'}
        </button>
      )}
      {state.status === 'completed' && (
        <a className="billing-contact" href="/leagues">
          Go to your account
        </a>
      )}
      <p>
        Payments are handled securely by Paddle. Your card details never reach Fantasy Broadcast.
      </p>
    </>
  )
}
