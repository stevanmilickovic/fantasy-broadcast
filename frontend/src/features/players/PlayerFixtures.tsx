import type { PlayerFixture, PlayerFixtureSchedule } from './types'

export function PlayerFixtures({
  schedule,
  gameweek,
  club,
}: {
  schedule?: PlayerFixtureSchedule
  gameweek: number
  club: string
}) {
  return (
    <section className="player-fixtures" aria-label="Club fixtures">
      <h3>Gameweek {gameweek} fixtures</h3>
      <p className="player-fixtures-help">Club schedule; appearances depend on team selection.</p>
      {!schedule || schedule.unavailableReason ? (
        <p>{schedule?.unavailableReason ?? 'Fixture details are unavailable.'}</p>
      ) : (
        <>
          {schedule.current.length ? (
            schedule.current.map((fixture) => (
              <FixtureRow key={fixture.id} fixture={fixture} club={club} />
            ))
          ) : (
            <p>No scheduled club fixture this gameweek.</p>
          )}
          <h3>Upcoming fixtures</h3>
          <p className="player-fixtures-help">FPL difficulty: 1 easiest · 5 hardest.</p>
          {schedule.upcoming.length ? (
            schedule.upcoming.map((week) => (
              <div className="player-fixture-week" key={week.gameweek}>
                <h4>GW {week.gameweek}</h4>
                <div>
                  {week.fixtures.length ? (
                    week.fixtures.map((fixture) => (
                      <FixtureRow key={fixture.id} fixture={fixture} club={club} />
                    ))
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
                <FixtureRow key={fixture.id} fixture={fixture} club={club} />
              ))}
            </>
          )}
          {schedule.fetchedAt && (
            <p className="player-fixtures-help">
              Fixtures received{' '}
              <time dateTime={schedule.fetchedAt}>
                {new Date(schedule.fetchedAt).toLocaleTimeString()}
              </time>
              .
            </p>
          )}
        </>
      )}
    </section>
  )
}

function FixtureRow({ fixture, club }: { fixture: PlayerFixture; club: string }) {
  const date = fixture.kickoffTime ? new Date(fixture.kickoffTime) : null
  const kickoff =
    date && Number.isFinite(date.getTime())
      ? new Intl.DateTimeFormat(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short',
        }).format(date)
      : 'Kickoff TBD'
  const status =
    fixture.status === 'LIVE'
      ? 'Live'
      : fixture.status === 'FINAL'
        ? 'Final'
        : fixture.status === 'TBD'
          ? 'TBD'
          : 'Scheduled'
  const scored = fixture.teamScore !== null && fixture.opponentScore !== null
  return (
    <div className="player-fixture-row" data-status={fixture.status}>
      <div>
        <strong>
          {fixture.opponent} · {fixture.home ? 'Home' : 'Away'}
        </strong>
        <small>
          <time dateTime={fixture.kickoffTime ?? undefined}>{kickoff}</time>
        </small>
        <small>
          {status}
          {scored && (
            <>
              {' '}
              ·{' '}
              <span
                aria-label={`${club} ${fixture.teamScore}, ${fixture.opponent} ${fixture.opponentScore}`}
              >
                {fixture.teamScore}–{fixture.opponentScore}
              </span>
            </>
          )}
        </small>
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
