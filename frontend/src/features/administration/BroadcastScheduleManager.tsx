import { useBroadcastScheduleManager } from './useBroadcastScheduleManager'

export function BroadcastScheduleManager() {
  const {
    query,
    schedules,
    startsAt,
    setStartsAt,
    endsAt,
    setEndsAt,
    editingId,
    message,
    busy,
    submit,
    generateToday,
    remove,
    edit,
  } = useBroadcastScheduleManager()
  return (
    <section className="league-discovery broadcast-schedule-manager">
      {query.status === 'loading' && <p>Loading…</p>}
      {query.error && (
        <p className="discovery-error" role="alert">
          {query.error}
        </p>
      )}
      <div className="discovery-form">
        <div>
          <span className="kicker">Broadcast administration</span>
          <h2>Broadcast schedules</h2>
          <p>Active schedules make the broadcast available for every registered league.</p>
        </div>
        <form className="broadcast-schedule-form" onSubmit={submit}>
          <label>
            Starts
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              required
            />
          </label>
          <label>
            Ends
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
              required
            />
          </label>
          <button disabled={busy}>{editingId ? 'Save changes' : 'Create broadcast'}</button>
        </form>
      </div>
      <div className="broadcast-schedule-actions">
        <button
          type="button"
          className="secondary-action"
          disabled={busy}
          onClick={() => void generateToday()}
        >
          Generate today from FPL fixtures
        </button>
        <small>
          Replaces today’s existing times. Uses a 15-minute lead-in, 3-hour window, and a maximum
          30-minute gap.
        </small>
      </div>
      {message && (
        <p
          className={
            message.includes('Generated') ||
            message === 'Broadcast schedule saved.' ||
            message === 'Broadcast time deleted.'
              ? 'broadcast-schedule-success'
              : 'discovery-error'
          }
        >
          {message}
        </p>
      )}
      <div className="broadcast-schedule-list">
        {schedules.length === 0 && (
          <p className="empty-text">No broadcast times have been scheduled.</p>
        )}
        {schedules.map((schedule) => (
          <div key={schedule.id}>
            <span>
              {new Date(schedule.startsAt).toLocaleString()} –{' '}
              {new Date(schedule.endsAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <div>
              <button className="secondary-action" disabled={busy} onClick={() => edit(schedule)}>
                Edit
              </button>
              <button
                className="secondary-action schedule-delete"
                disabled={busy}
                onClick={() => void remove(schedule)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
