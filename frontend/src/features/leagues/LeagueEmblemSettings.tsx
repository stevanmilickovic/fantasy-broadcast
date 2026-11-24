import { useState } from 'react'
import { useMutation } from '../../shared/api/useMutation'
import { deleteTeamEmblem, uploadTeamEmblem } from './api'
import { TeamEmblem } from './TeamEmblem'
import { useTeamEmblems } from './teamEmblems'

export function LeagueEmblemSettings({ leagueId }: { leagueId: number }) {
  const { teams, loading, error, refresh } = useTeamEmblems()
  const saving = useMutation()
  const [validation, setValidation] = useState('')
  const [editedEntry, setEditedEntry] = useState<number>()
  const save = async (entryId: number, file: File) => {
    setEditedEntry(entryId)
    setValidation('')
    saving.reset()
    if (!file.name.toLowerCase().endsWith('.png')) {
      setValidation('Choose a PNG image, preferably with a transparent background.')
      return
    }
    if (file.size > 5_000_000) {
      setValidation('Choose a PNG image no larger than 5 MB.')
      return
    }
    if (await saving.run((signal) => uploadTeamEmblem(leagueId, entryId, file, signal))) refresh()
  }
  const remove = async (entryId: number) => {
    setEditedEntry(entryId)
    setValidation('')
    if (await saving.run((signal) => deleteTeamEmblem(leagueId, entryId, signal))) refresh()
  }
  return (
    <section className="league-emblem-settings" aria-label="Team emblem uploads">
      <p>
        Use a square PNG up to 5 MB and 4096 pixels per side. For best results, use at least 512 ×
        512 pixels and a transparent background.
      </p>
      {loading && <p role="status">Loading teams…</p>}
      {error && (
        <p role="alert">
          {error}{' '}
          <button type="button" onClick={refresh}>
            Retry
          </button>
        </p>
      )}
      {saving.busy && <p role="status">Saving emblem…</p>}
      {saving.status === 'success' && !loading && <p role="status">Team emblem saved.</p>}
      <ul className="league-emblem-list">
        {teams.map((team) => (
          <li key={team.entryId}>
            <div className="league-emblem-team">
              <TeamEmblem entryId={team.entryId} />
              <strong>{team.name}</strong>
            </div>
            <div className="league-emblem-actions">
              <label className="league-emblem-upload">
                {team.url ? 'Replace PNG' : 'Upload PNG'}
                <input
                  type="file"
                  accept="image/png,.png"
                  aria-label={`Upload PNG for ${team.name}`}
                  disabled={saving.busy || loading}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0]
                    event.currentTarget.value = ''
                    if (file) void save(team.entryId, file)
                  }}
                />
              </label>
              {team.url && (
                <button
                  type="button"
                  disabled={saving.busy || loading}
                  aria-label={`Remove emblem for ${team.name}`}
                  onClick={() => void remove(team.entryId)}
                >
                  Remove
                </button>
              )}
            </div>
            {editedEntry === team.entryId && (validation || saving.error) && (
              <p className="league-emblem-error" role="alert">
                {validation || saving.error}
              </p>
            )}
          </li>
        ))}
      </ul>
      {!loading && !error && !teams.length && <p>No teams are available yet.</p>}
    </section>
  )
}
