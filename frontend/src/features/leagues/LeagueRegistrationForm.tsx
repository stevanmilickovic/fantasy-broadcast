import { useRef, useState, type FormEvent } from 'react'
import { positiveId } from '../../app/routes'
import type { Navigate } from '../../app/useBrowserNavigation'
import { previewLeaguePayment } from '../billing/api'
import { readBillingPlan } from '../billing/billingPlans'
import type { LeaguePaymentPreview } from '../billing/types'
import { useMutation } from '../../shared/api/useMutation'
import type { FplLeagueType } from '../../shared/fpl/types'

export function LeagueRegistrationForm({
  search,
  navigate,
}: {
  search: string
  navigate: Navigate
}) {
  const parameters = new URLSearchParams(search)
  const plan = readBillingPlan(parameters.get('plan'))
  const [leagueId, setLeagueId] = useState(parameters.get('fplLeagueId') ?? '')
  const [leagueType, setLeagueType] = useState<FplLeagueType>(
    parameters.get('leagueType') === 'CLASSIC' ? 'CLASSIC' : 'DRAFT',
  )
  const [preview, setPreview] = useState<LeaguePaymentPreview>()
  const [invalidId, setInvalidId] = useState(false)
  const leagueInput = useRef<HTMLInputElement>(null)
  const verification = useMutation()
  const error = invalidId
    ? 'Enter a valid, positive FPL league ID.'
    : (verification.error ?? preview?.validationMessage)
  const verified = preview?.registrationEligible === true

  const clearVerification = () => {
    setPreview(undefined)
    setInvalidId(false)
    verification.reset()
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (verification.busy) return
    const id = positiveId(leagueId.trim())
    if (!id) {
      setInvalidId(true)
      leagueInput.current?.focus()
      return
    }
    if (verified && preview.checkoutReady) {
      const draft = new URLSearchParams({ fplLeagueId: String(id), leagueType })
      if (plan) draft.set('plan', plan)
      navigate(`/leagues/new?${draft}`, true)
      navigate(`/leagues/checkout?${draft}`)
      return
    }
    const result = await verification.run((signal) =>
      previewLeaguePayment(String(id), leagueType, signal),
    )
    if (result) setPreview(result.data)
  }

  return (
    <div className="register-league-card">
      <h1>Register a league</h1>
      <p>Enter your FPL league ID to add a league you manage.</p>
      <form onSubmit={(event) => void submit(event)} noValidate>
        <label htmlFor="customer-league-id">League ID</label>
        <input
          ref={leagueInput}
          id="customer-league-id"
          inputMode="numeric"
          value={leagueId}
          required
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'registration-league-error' : undefined}
          disabled={verification.busy}
          onChange={(event) => {
            setLeagueId(event.target.value)
            clearVerification()
          }}
        />
        <span className="league-type-label">League type</span>
        <div className="league-type-toggle" role="group" aria-label="League type">
          {(['DRAFT', 'CLASSIC'] as const).map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={leagueType === type}
              className={leagueType === type ? 'selected' : ''}
              disabled={verification.busy}
              onClick={() => {
                if (type !== leagueType) {
                  setLeagueType(type)
                  clearVerification()
                }
              }}
            >
              {type === 'DRAFT' ? 'Draft' : 'Classic'}
            </button>
          ))}
        </div>
        {error && (
          <p id="registration-league-error" className="checkout-league-error" role="alert">
            {error}
          </p>
        )}
        {verified && (
          <div role="status">
            <strong>{preview.displayName}</strong>
            <p>
              {leagueType === 'CLASSIC' ? 'Classic' : 'Draft'} league · {preview.managerCount}{' '}
              managers
            </p>
            {!preview.checkoutReady && (
              <p>New league registrations are temporarily unavailable. Please try again later.</p>
            )}
          </div>
        )}
        <button type="submit" disabled={verification.busy}>
          {verification.busy
            ? 'Verifying league…'
            : verified && preview.checkoutReady
              ? 'Continue to review'
              : 'Verify league'}
        </button>
      </form>
    </div>
  )
}
