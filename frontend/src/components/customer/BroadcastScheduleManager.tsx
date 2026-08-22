import { useEffect, useState } from 'react'
import { loadBroadcastSchedules, saveBroadcastSchedule } from '../../api/customerApi'
import type { BroadcastSchedule } from '../../types/customer'

const localValue = (iso: string) => {
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function BroadcastScheduleManager({ token }: { token: string }) {
  const [schedules, setSchedules] = useState<BroadcastSchedule[]>([])
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [editingId, setEditingId] = useState<number | undefined>()
  const [message, setMessage] = useState<string | null>(null)
  const refresh = async () => setSchedules(await loadBroadcastSchedules(token))
  useEffect(() => { void refresh().catch((error: Error) => setMessage(error.message)) }, [token])
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    try { await saveBroadcastSchedule(token, startsAt, endsAt, editingId); await refresh(); setStartsAt(''); setEndsAt(''); setEditingId(undefined); setMessage('Broadcast schedule saved.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save broadcast schedule.') }
  }
  const edit = (schedule: BroadcastSchedule) => { setEditingId(schedule.id); setStartsAt(localValue(schedule.startsAt)); setEndsAt(localValue(schedule.endsAt)); setMessage(null) }
  return <section className="league-discovery broadcast-schedule-manager"><div className="discovery-form"><div><span className="kicker">Broadcast administration</span><h2>Broadcast schedules</h2><p>Active schedules make the broadcast available for every registered league.</p></div><form className="broadcast-schedule-form" onSubmit={submit}><label>Starts<input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required /></label><label>Ends<input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} required /></label><button>{editingId ? 'Save changes' : 'Create broadcast'}</button></form></div>{message && <p className={message === 'Broadcast schedule saved.' ? 'broadcast-schedule-success' : 'discovery-error'}>{message}</p>}<div className="broadcast-schedule-list">{schedules.length === 0 && <p className="empty-text">No broadcast times have been scheduled.</p>}{schedules.map((schedule) => <div key={schedule.id}><span>{new Date(schedule.startsAt).toLocaleString()} – {new Date(schedule.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><button className="secondary-action" onClick={() => edit(schedule)}>Edit</button></div>)}</div></section>
}
