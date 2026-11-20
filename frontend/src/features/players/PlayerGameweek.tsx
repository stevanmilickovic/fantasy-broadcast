import type { PlayerDetails } from './types'
import { PlayerFixtureResult } from './PlayerFixtures'

export function PlayerGameweek({
  details,
  showFixtures = true,
}: {
  details: PlayerDetails
  showFixtures?: boolean
}) {
  const fixtures = details.fixtureSchedule?.current ?? []
  const unassigned = details.changes.filter(
    (change) => !fixtures.some((fixture) => fixture.id === change.fixture),
  )
  return (
    <>
      <div className="player-details-total">
        <span>Total</span>
        <strong>{details.points === null ? '—' : `${details.points} pts`}</strong>
      </div>
      {fixtures.map((fixture) => (
        <section
          className="player-fixture-points"
          key={fixture.id}
          aria-label={`${details.club} vs ${fixture.opponent}`}
        >
          <PlayerFixtureResult fixture={fixture} club={details.club} />
          <PointChanges
            changes={details.changes.filter((change) => change.fixture === fixture.id)}
          />
        </section>
      ))}
      {showFixtures && (!details.fixtureSchedule || details.fixtureSchedule.unavailableReason) && (
        <p>{details.fixtureSchedule?.unavailableReason ?? 'Fixture details are unavailable.'}</p>
      )}
      {details.fixtureSchedule &&
        !details.fixtureSchedule.unavailableReason &&
        !fixtures.length && <p>No scheduled club fixture this gameweek.</p>}
      <PointChanges changes={unassigned} />
      {!details.changes.length && <p>No point changes recorded this gameweek.</p>}
    </>
  )
}

function PointChanges({ changes }: { changes: PlayerDetails['changes'] }) {
  return changes.map((change, index) => (
    <div className="player-details-row" key={`${change.fixture}-${change.stat}-${index}`}>
      <span>
        {change.stat.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())}
        {change.value > 1 ? ` × ${change.value}` : ''}
      </span>
      <strong>
        {change.points > 0 ? '+' : ''}
        {change.points}
      </strong>
    </div>
  ))
}
