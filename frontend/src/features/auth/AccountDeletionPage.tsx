import { useState } from 'react'
import { useMutation } from '../../shared/api/useMutation'
import { requestAccountDeletion } from './api'

export function AccountDeletionPage() {
  const request = useMutation()
  const [message, setMessage] = useState<string | null>(null)
  const submit = async () => {
    if (
      !window.confirm(
        'Request deletion of your Fantasy Broadcast account? Active subscriptions must be cancelled before the request can be completed.',
      )
    )
      return
    const result = await request.run((signal) => requestAccountDeletion(signal))
    if (result) setMessage(result.data.message)
  }
  return (
    <section className="account-deletion-request">
      <span className="kicker">Account and data</span>
      <h1>Request account deletion</h1>
      <p>
        We will delete your Fantasy Broadcast account and associated personal data unless we need to
        retain limited information for legal, security, fraud-prevention, or accounting purposes.
      </p>
      <p>
        If you have an active subscription, cancel it through Paddle first. Your request will then
        be reviewed before deletion is completed.
      </p>
      {(message || request.error) && (
        <p className="account-deletion-message" role="status">
          {message ?? request.error}
        </p>
      )}
      <button
        type="button"
        className="secondary-action"
        onClick={() => void submit()}
        disabled={request.busy || Boolean(message)}
      >
        Request account deletion
      </button>
    </section>
  )
}
