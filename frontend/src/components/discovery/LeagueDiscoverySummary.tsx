import { useState } from 'react'
import type { DiscoveryTab, LeagueDiscoveryState } from '../../types/fpl'

export function LeagueDiscoverySummary({ discovery, showBroadcastControl = false }: { discovery: LeagueDiscoveryState; showBroadcastControl?: boolean }) {
  const [activeTab, setActiveTab] = useState<DiscoveryTab>('teams')
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null)
  const { details, elementStatus } = discovery
  const entries = details.league_entries ?? []
  const matches = details.matches ?? []
  const standings = details.standings ?? []
  const playerStatuses = elementStatus.element_status ?? []
  const ownedPlayers = playerStatuses.filter((status) => status.owner !== null)
  const freeAgents = playerStatuses.length - ownedPlayers.length
  const entryNamesById = new Map(entries.map((entry) => [entry.id, entry.entry_name]))
  const entryNamesByEntryId = new Map(entries.map((entry) => [entry.entry_id, entry.entry_name]))
  const playersById = new Map(discovery.players.map((player) => [player.id, player]))
  const livePlayersById = new Map((discovery.livePlayers ?? []).map((player) => [player.id, player]))
  const activeFixtureCount = discovery.draftEventLive?.fixtures.filter((fixture) => fixture.started && !fixture.finished).length ?? 0
  const hasCompositions = ownedPlayers.length > 0
  const hasMatchups = matches.length > 0
  const hasStandings = standings.length > 0
  const selectedEntry = entries.find((entry) => entry.entry_id === selectedEntryId) ?? null
  const selectedEntryPicks = selectedEntry ? discovery.entryEvents?.[String(selectedEntry.entry_id)]?.picks ?? [] : []
  const selectedPicksByElement = new Map(selectedEntryPicks.map((pick) => [pick.element, pick]))
  const selectedPlayers = selectedEntry
    ? ownedPlayers
        .filter((status) => status.owner === selectedEntry.entry_id)
        .map((status) => ({
          status,
          player: playersById.get(status.element),
          pick: selectedPicksByElement.get(status.element),
          livePlayer: livePlayersById.get(status.element),
        }))
        .sort((first, second) => {
          if (first.pick && second.pick) {
            return first.pick.position - second.pick.position
          }
          const firstName = first.player?.webName ?? String(first.status.element)
          const secondName = second.player?.webName ?? String(second.status.element)
          return firstName.localeCompare(secondName)
        })
    : []

  return (
    <div className="discovery-results">
      <div className="discovery-title">
        <div>
          <h3>{details.league?.name ?? 'Draft League'}</h3>
          <p>
            Draft {details.league?.draft_status ?? 'unknown'} · {entries.length} teams · scoring{' '}
            {details.league?.scoring ?? 'unknown'}
          </p>
        </div>
        <div className="discovery-title-actions">
          <span>{details.league?.id ?? 'Unknown ID'}</span>
          {showBroadcastControl && <button type="button" className="inactive-broadcast" disabled>Enter broadcast · inactive</button>}
        </div>
      </div>

      <div className="readiness-grid">
        <ReadinessItem
          label="Team compositions"
          value={hasCompositions ? `${ownedPlayers.length} owned players` : 'Not available yet'}
          ready={hasCompositions}
        />
        <ReadinessItem label="Matchups" value={hasMatchups ? `${matches.length} scheduled` : 'Not prepared yet'} ready={hasMatchups} />
        <ReadinessItem label="Standings" value={hasStandings ? `${standings.length} rows` : 'Not available yet'} ready={hasStandings} />
        <ReadinessItem label="Free agents" value={playerStatuses.length > 0 ? `${freeAgents} players` : 'Unknown'} ready={playerStatuses.length > 0} />
        <ReadinessItem label="Live fixtures" value={activeFixtureCount > 0 ? `${activeFixtureCount} just started` : 'None active'} ready={activeFixtureCount > 0} />
      </div>

      <div className="discovery-tabs" role="tablist" aria-label="League discovery sections">
        <DiscoveryTabButton activeTab={activeTab} tab="teams" label="Teams" onSelect={setActiveTab} />
        <DiscoveryTabButton activeTab={activeTab} tab="compositions" label="Compositions" onSelect={setActiveTab} />
        <DiscoveryTabButton activeTab={activeTab} tab="matchups" label="Matchups" onSelect={setActiveTab} />
        <DiscoveryTabButton activeTab={activeTab} tab="standings" label="Standings" onSelect={setActiveTab} />
      </div>

      <div className="discovery-panel">
        {activeTab === 'teams' && (
          <section>
            <h4>Teams Present</h4>
            <div className="compact-list">
              {entries.map((entry) => (
                <button
                  className="compact-row compact-button"
                  type="button"
                  key={entry.id}
                  onClick={() => {
                    setSelectedEntryId(entry.entry_id)
                    setActiveTab('compositions')
                  }}
                >
                  <strong>{entry.entry_name}</strong>
                  <span>
                    {entry.player_first_name} {entry.player_last_name} · entry {entry.entry_id} · league entry {entry.id}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'compositions' && (
          <section>
            <h4>Team Compositions</h4>
            {!hasCompositions ? (
              <p className="empty-text compact-empty">No owned players returned by FPL yet.</p>
            ) : (
              <div className="composition-layout">
                <div className="team-picker">
                  {entries.map((entry) => {
                    const squadSize = ownedPlayers.filter((status) => status.owner === entry.entry_id).length
                    return (
                      <button
                        type="button"
                        key={entry.entry_id}
                        className={selectedEntryId === entry.entry_id ? 'selected-team' : ''}
                        onClick={() => setSelectedEntryId(entry.entry_id)}
                      >
                        <strong>{entry.entry_name}</strong>
                        <span>{squadSize} players</span>
                      </button>
                    )
                  })}
                </div>
                <div className="player-composition">
                  {selectedEntry ? (
                    <>
                      <div className="composition-heading">
                        <strong>{selectedEntry.entry_name}</strong>
                        <span>{selectedPlayers.length} owned players</span>
                      </div>
                      <div className="compact-list">
                        {selectedPlayers.map(({ status, player, pick, livePlayer }) => (
                          <div className="compact-row player-composition-row" key={status.element}>
                            <strong>{player?.webName ?? `Player ${status.element}`}</strong>
                            <span>
                              {player?.fullName ?? 'Unknown player'} · {player?.premierLeagueClub ?? 'Unknown club'} ·{' '}
                              {player?.position ?? 'Unknown position'} · {pick ? (pick.starter ? 'starter' : 'bench') : 'no pick'}{' '}
                              {pick ? `#${pick.position}` : ''} · {livePlayer?.stats.minutes ?? 0} min ·{' '}
                              {livePlayer?.stats.totalPoints ?? 0} pts
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="empty-text compact-empty">Select a team to inspect its players.</p>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === 'matchups' && (
          <section>
            <h4>Matchups</h4>
            <div className="compact-list">
              {matches.length === 0 ? (
                <p className="empty-text compact-empty">No matchups returned by FPL yet.</p>
              ) : (
                matches.map((match, index) => {
                  const firstEntryId = match.league_entry_1 ?? match.firstLeagueEntryId ?? 0
                  const secondEntryId = match.league_entry_2 ?? match.secondLeagueEntryId ?? 0
                  const firstPoints = match.league_entry_1_points ?? match.firstPoints ?? 0
                  const secondPoints = match.league_entry_2_points ?? match.secondPoints ?? 0
                  return (
                    <div className="compact-row" key={`${match.event}-${firstEntryId}-${secondEntryId}-${index}`}>
                      <strong>
                        GW{match.event}: {entryNamesById.get(firstEntryId) ?? firstEntryId} vs{' '}
                        {entryNamesById.get(secondEntryId) ?? secondEntryId}
                      </strong>
                      <span>
                        {firstPoints}-{secondPoints} · {match.finished ? 'finished' : 'not finished'}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </section>
        )}

        {activeTab === 'standings' && (
          <section>
            <h4>Standings</h4>
            <div className="standings-table">
              {standings.length === 0 ? (
                <p className="empty-text compact-empty">No standings returned by FPL yet.</p>
              ) : (
                standings
                  .slice()
                  .sort((first, second) => first.rank - second.rank)
                  .map((standing, index) => {
                    const entryId = standing.league_entry ?? standing.leagueEntryId ?? 0
                    const points = standing.total ?? standing.headToHeadPoints ?? 0
                    const pointsFor = standing.points_for ?? standing.pointsFor ?? 0
                    return (
                      <div className="standings-row" key={`${entryId}-${index}`}>
                        <strong>{standing.rank || index + 1}</strong>
                        <span>{entryNamesById.get(entryId) ?? entryNamesByEntryId.get(entryId) ?? entryId}</span>
                        <small>{points} pts</small>
                        <small>{pointsFor} PF</small>
                      </div>
                    )
                  })
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function DiscoveryTabButton({
  activeTab,
  tab,
  label,
  onSelect,
}: {
  activeTab: DiscoveryTab
  tab: DiscoveryTab
  label: string
  onSelect: (tab: DiscoveryTab) => void
}) {
  return (
    <button type="button" className={activeTab === tab ? 'active-tab' : ''} onClick={() => onSelect(tab)}>
      {label}
    </button>
  )
}

function ReadinessItem({ label, value, ready }: { label: string; value: string; ready: boolean }) {
  return (
    <div className="readiness-item">
      <span className={ready ? 'ready-dot' : 'waiting-dot'} />
      <div>
        <strong>{label}</strong>
        <small>{value}</small>
      </div>
    </div>
  )
}
