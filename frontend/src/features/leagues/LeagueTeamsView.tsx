import { LeagueSelect } from './LeagueSelect'
import { useState } from 'react'
import type { LeagueDiscoveryState } from '../../shared/fpl/types'
import { useShirtCodes } from '../../shared/fpl/useShirtCodes'
import { managerName, standingEntryId } from './leagueData'
import { LeagueTeamVisual } from './LeagueTeamVisual'

export function LeagueTeamsView({
  discovery,
  leagueId,
  selectedId,
  onSelect,
}: {
  discovery: LeagueDiscoveryState
  leagueId: number
  selectedId: number
  onSelect: (id: number) => void
}) {
  const [search, setSearch] = useState('')
  const shirts = useShirtCodes()
  const entries = discovery.details.league_entries
  const firstStanding = [...discovery.details.standings].sort((a, b) => a.rank - b.rank)[0]
  const selected =
    entries.find((entry) => entry.entry_id === selectedId) ??
    entries.find(
      (entry) =>
        firstStanding &&
        (entry.id === standingEntryId(firstStanding) ||
          entry.entry_id === standingEntryId(firstStanding)),
    ) ??
    entries[0]
  const filtered = entries.filter((entry) =>
    `${entry.entry_name} ${entry.player_first_name} ${entry.player_last_name}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  )
  if (!selected) return <p className="league-empty">No clubs returned by FPL yet.</p>
  return (
    <section className="league-teams-view">
      <div className="league-club-select league-select-field">
        <span>Club</span>
        <LeagueSelect
          label="Club"
          value={selected.entry_id}
          onChange={onSelect}
          options={entries.map((entry) => ({
            value: entry.entry_id,
            label: entry.entry_name,
            description: managerName(entry.player_first_name, entry.player_last_name),
          }))}
        />
      </div>
      <aside className="league-manager-panel">
        <label>
          Search clubs
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Club or manager"
          />
        </label>
        <div className="manager-grid">
          {filtered.map((entry) => (
            <button
              key={entry.entry_id}
              aria-pressed={selected.entry_id === entry.entry_id}
              onClick={() => onSelect(entry.entry_id)}
            >
              <strong>{entry.entry_name}</strong>
              <span>{managerName(entry.player_first_name, entry.player_last_name)}</span>
            </button>
          ))}
        </div>
        {!filtered.length && <p>No clubs match your search.</p>}
      </aside>
      <LeagueTeamVisual
        key={selected.entry_id}
        discovery={discovery}
        entryId={selected.entry_id}
        entryName={selected.entry_name}
        manager={managerName(selected.player_first_name, selected.player_last_name)}
        shirtCodes={shirts}
        leagueId={leagueId}
      />
    </section>
  )
}
