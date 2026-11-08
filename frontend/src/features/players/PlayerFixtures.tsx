import type { PlayerFixture, PlayerFixtureSchedule } from './types'

export function PlayerFixtures({ schedule }: { schedule?: PlayerFixtureSchedule }) {
  if (!schedule || schedule.unavailableReason)
    return <p>{schedule?.unavailableReason ?? 'Fixture details are unavailable.'}</p>
  return (
    <section className="player-fixtures" aria-label="Upcoming fixtures">
      {schedule.upcoming.length ? (
        schedule.upcoming.map((week) => (
          <div className="player-fixture-week" key={week.gameweek}>
            <h4>GW {week.gameweek}</h4>
            <div>
              {week.fixtures.length ? (
                week.fixtures.map((fixture) => <FixtureRow key={fixture.id} fixture={fixture} />)
              ) : (
                <p>No scheduled fixture</p>
              )}
            </div>
          </div>
        ))
      ) : (
        <p>No further gameweeks this season.</p>
      )}
      {schedule.unscheduled.length > 0 && (
        <>
          <h3>Gameweek TBD</h3>
          {schedule.unscheduled.map((fixture) => (
            <FixtureRow key={fixture.id} fixture={fixture} />
          ))}
        </>
      )}
    </section>
  )
}

const fixtureStatus = (fixture: PlayerFixture) =>
  fixture.status === 'LIVE'
    ? 'Live'
    : fixture.status === 'FINAL'
      ? 'Final'
      : fixture.status === 'TBD'
        ? 'TBD'
        : 'Scheduled'

export function PlayerFixtureResult({ fixture, club }: { fixture: PlayerFixture; club: string }) {
  const home = fixture.home ? club : fixture.opponent
  const away = fixture.home ? fixture.opponent : club
  const scored = fixture.status === 'LIVE' || fixture.status === 'FINAL'
  const homeScore = scored ? (fixture.home ? fixture.teamScore : fixture.opponentScore) : null
  const awayScore = scored ? (fixture.home ? fixture.opponentScore : fixture.teamScore) : null
  return (
    <header className="player-fixture-result" data-status={fixture.status}>
      <span>{home}</span>
      <strong aria-label={`${home} ${homeScore ?? '—'}, ${away} ${awayScore ?? '—'}`}>
        {homeScore ?? '—'}
        <span aria-hidden="true">–</span>
        {awayScore ?? '—'}
      </strong>
      <span>{away}</span>
      <small>{fixtureStatus(fixture)}</small>
    </header>
  )
}

function FixtureRow({ fixture }: { fixture: PlayerFixture }) {
  return (
    <div className="player-fixture-row" data-status={fixture.status}>
      <div>
        <strong>
          {fixture.opponent} · {fixture.home ? 'Home' : 'Away'}
        </strong>
        <small>{fixtureStatus(fixture)}</small>
      </div>
      <span
        className="fixture-difficulty"
        data-difficulty={fixture.difficulty ?? undefined}
        aria-label={
          fixture.difficulty === null
            ? 'Difficulty unavailable'
            : `Difficulty ${fixture.difficulty} of 5`
        }
      >
        {fixture.difficulty ?? '—'}
      </span>
    </div>
  )
}
