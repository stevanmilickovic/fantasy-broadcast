import { Shirt } from 'lucide-react'
import { TeamEmblem } from './TeamEmblem'
import { useState } from 'react'
import { PlayerDetailsModal, type SelectedPlayer } from '../players/PlayerDetailsModal'
import { shirtCodeFor, shirtUrlFor } from '../../shared/fpl/shirts'
import type { FplClubShirt, LeagueDiscoveryState } from '../../shared/fpl/types'
import { type LeaguePlayer, leaguePlayersForEntry } from './leagueData'
import { playerAvailability } from '../../shared/fpl/availability'
export function LeagueTeamVisual({
  discovery,
  entryId,
  entryName,
  manager,
  shirtCodes,
  leagueId,
}: {
  discovery: LeagueDiscoveryState
  entryId: number
  entryName: string
  manager: string
  shirtCodes: FplClubShirt[]
  leagueId?: number
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<SelectedPlayer | null>(null)
  const players = leaguePlayersForEntry(discovery, entryId)
  const starters = players.filter((player) => player.starter)
  const bench = players.filter((player) => !player.starter)
  const groups = [
    ['FWD', 'Forwards', starters.filter((player) => player.position === 'FWD')],
    ['MID', 'Midfielders', starters.filter((player) => player.position === 'MID')],
    ['DEF', 'Defenders', starters.filter((player) => player.position === 'DEF')],
    ['GKP', 'Goalkeeper', starters.filter((player) => player.position === 'GKP')],
    ['BENCH', 'Bench', bench],
  ] as const

  return (
    <section className="league-team-stage" aria-label={`${entryName} players`}>
      <header>
        <span>{manager}</span>
        <h2>
          <TeamEmblem entryId={entryId} />
          {entryName}
        </h2>
        <strong aria-label="Current starter points">
          {starters.length > 0 &&
          starters.every((player) => discovery.livePlayers?.some((live) => live.id === player.id))
            ? `${starters.reduce((total, player) => total + player.points, 0)} pts`
            : '—'}
        </strong>
        <small>Gameweek {discovery.gameweek ?? '—'} · Starter points</small>
      </header>
      {players.length === 0 && <p>No squad available for this club.</p>}
      {players.length > 0 && !discovery.livePlayers?.length && (
        <p>Player points are not available yet.</p>
      )}
      <div className="league-total-player-rows">
        {groups.map(
          ([key, label, groupPlayers]) =>
            groupPlayers.length > 0 && (
              <section className="league-total-player-row" key={key}>
                <span>{label}</span>
                <div>
                  {groupPlayers.map((player) => (
                    <LeaguePlayerToken
                      key={player.id}
                      player={player}
                      shirtCode={shirtCodeFor(player.club, shirtCodes)}
                      available={Boolean(
                        discovery.livePlayers?.some((live) => live.id === player.id),
                      )}
                      onSelect={setSelectedPlayer}
                    />
                  ))}
                </div>
              </section>
            ),
        )}
      </div>
      {selectedPlayer && leagueId && discovery.gameweek && (
        <PlayerDetailsModal
          key={selectedPlayer.id}
          player={selectedPlayer}
          leagueId={leagueId}
          gameweek={discovery.gameweek}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </section>
  )
}

function LeaguePlayerToken({
  player,
  shirtCode,
  available,
  onSelect,
}: {
  player: LeaguePlayer
  shirtCode?: number
  available: boolean
  onSelect: (player: SelectedPlayer) => void
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const availability = playerAvailability(player.availability)
  const shirtUrl = shirtUrlFor(shirtCode, player.position)
  return (
    <button
      type="button"
      className="league-player-token"
      onClick={() => onSelect({ id: player.id, name: player.fullName, shirtUrl })}
      aria-label={`View ${player.fullName} points${availability.severity ? ` — ${availability.label}` : ''}`}
      data-availability={availability.severity}
    >
      <div className="player-core">
        <div className="shirt-wrap">
          {shirtUrl && !imageFailed ? (
            <img src={shirtUrl} alt={`${player.club} shirt`} onError={() => setImageFailed(true)} />
          ) : (
            <Shirt size={30} aria-hidden="true" />
          )}
        </div>
        <div className="player-meta">
          <strong>{player.name}</strong>
          <small>{player.club}</small>
          <b>{!available || (player.points === 0 && player.minutes === 0) ? '-' : player.points}</b>
        </div>
      </div>
    </button>
  )
}
