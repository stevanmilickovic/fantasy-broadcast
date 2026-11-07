import type { FormEvent } from 'react'
import type { FplLeagueType } from '../../shared/fpl/types'

export function LeagueRegistrationForm({
  leagueId,
  leagueType,
  onLeagueIdChange,
  onLeagueTypeChange,
  onSubmit,
}: {
  leagueId: string
  leagueType: FplLeagueType
  onLeagueIdChange: (value: string) => void
  onLeagueTypeChange: (value: FplLeagueType) => void
  onSubmit: (event: FormEvent) => void
}) {
  return (
    <div className="register-league-card">
      <span className="kicker">Create</span>
      <h1>Register a league</h1>
      <p>Enter your FPL league ID to add a league you manage.</p>
      <form onSubmit={onSubmit}>
        <label htmlFor="customer-league-id">League ID</label>
        <input
          id="customer-league-id"
          inputMode="numeric"
          value={leagueId}
          required
          pattern="[0-9]+"
          onChange={(event) => onLeagueIdChange(event.target.value)}
        />
        <span className="league-type-label">League type</span>
        <div className="league-type-toggle" role="group" aria-label="League type">
          {(['DRAFT', 'CLASSIC'] as const).map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={leagueType === type}
              className={leagueType === type ? 'selected' : ''}
              onClick={() => onLeagueTypeChange(type)}
            >
              {type === 'DRAFT' ? 'Draft' : 'Classic'}
            </button>
          ))}
        </div>
        <button type="submit">Register my league</button>
      </form>
    </div>
  )
}
