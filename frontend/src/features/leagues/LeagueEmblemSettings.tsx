import { useState } from 'react'
import { useMutation } from '../../shared/api/useMutation'
import { deleteTeamEmblem, uploadTeamEmblem } from './api'
import { TeamEmblem } from './TeamEmblem'
import { useTeamEmblems } from './teamEmblems'

export function LeagueEmblemSettings({ leagueId }: { leagueId: number }) {
  const { teams, loading, error, refresh } = useTeamEmblems()
  const saving = useMutation()
  const [validation, setValidation] = useState('')
  const save = async (entryId: number, file: File) => {
    setValidation('')
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
    setValidation('')
    if (await saving.run((signal) => deleteTeamEmblem(leagueId, entryId, signal))) refresh()
  }
  return (
    <section className="league-emblem-settings" aria-labelledby="team-emblems-title">
      <h2 id="team-emblems-title">Team emblems</h2>
      <p>
        Upload a PNG for each team, preferably with a transparent background. Images are
        automatically resized and compressed.
      </p>
      <small>
        PNG up to 5 MB and 4096 pixels per side. A square image of at least 512 × 512 pixels works
        best.
      </small>
      {loading && <p role="status">Loading teams…</p>}
      {error && (
        <p role="alert">
          {error}{' '}
          <button type="button" onClick={refresh}>
            Retry
          </button>
        </p>
      )}
      {(validation || saving.error) && <p role="alert">{validation || saving.error}</p>}
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
          </li>
        ))}
      </ul>
      {!loading && !error && !teams.length && <p>No teams are available yet.</p>}
    </section>
  )
}
