import { useState } from 'react'
import { useMutation } from '../../shared/api/useMutation'
import { useQuery } from '../../shared/api/useQuery'
import {
  deleteBroadcastSchedule,
  generateTodayBroadcastSchedules,
  loadBroadcastSchedules,
  saveBroadcastSchedule,
} from './api'
import type { BroadcastSchedule } from './types'
const localValue = (iso: string) => {
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
export function useBroadcastScheduleManager() {
  const query = useQuery('broadcast-schedules', loadBroadcastSchedules)
  const schedules = query.data ?? []
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [editingId, setEditingId] = useState<number | undefined>()
  const [notice, setMessage] = useState<string | null>(null)
  const mutation = useMutation()
  const busy = mutation.busy
  const message = mutation.error ?? notice
  const refresh = query.refresh
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const result = await mutation.run((signal) =>
      saveBroadcastSchedule(startsAt, endsAt, editingId, signal),
    )
    if (!result) return

    await refresh()
    setStartsAt('')
    setEndsAt('')
    setEditingId(undefined)
    setMessage('Broadcast schedule saved.')
  }
  const generateToday = async () => {
    if (!window.confirm('Replace all of today’s broadcast times with FPL fixture windows?')) return
    const result = await mutation.run((signal) => generateTodayBroadcastSchedules(signal))
    if (!result) return
    const generated = result.data

    refresh()
    setMessage(
      generated.length === 0
        ? 'No unfinished FPL fixtures were found for today.'
        : `Generated ${generated.length} broadcast time${generated.length === 1 ? '' : 's'} for today.`,
    )
  }
  const remove = async (schedule: BroadcastSchedule) => {
    if (!window.confirm('Delete this broadcast time?')) return
    const result = await mutation.run((signal) => deleteBroadcastSchedule(schedule.id, signal))
    if (!result) return

    await refresh()
    setMessage('Broadcast time deleted.')
  }
  const edit = (schedule: BroadcastSchedule) => {
    setEditingId(schedule.id)
    setStartsAt(localValue(schedule.startsAt))
    setEndsAt(localValue(schedule.endsAt))
    setMessage(null)
  }

  return {
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
  }
}
