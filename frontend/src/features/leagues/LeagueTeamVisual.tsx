import { useState } from 'react'
import { PlayerDetailsModal, type SelectedPlayer } from '../players/PlayerDetailsModal'
import type { CSSProperties } from 'react'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { shirtCodeFor } from '../../shared/fpl/shirts'
import type { FplClubShirt, LeagueDiscoveryState } from '../../shared/fpl/types'
import { type LeaguePlayer, leaguePlayersForEntry } from './leagueData'
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
  const stageRef = useRef<HTMLElement>(null)
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
  useEffect(() => {
    if (!window.matchMedia('(max-width: 700px)').matches) return
    const frame = window.requestAnimationFrame(() =>
      stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    )
    return () => window.cancelAnimationFrame(frame)
  }, [entryId])

  return (
    <section ref={stageRef} className="league-team-stage" aria-label={`${entryName} players`}>
      <header>
        <span>{manager}</span>
        <FitClubName text={entryName} />
        <strong>{starters.reduce((total, player) => total + player.points, 0)} pts</strong>
      </header>
      <div className="league-total-player-rows">
        {groups.map(
          ([key, label, groupPlayers]) =>
            groupPlayers.length > 0 && (
              <section className="league-total-player-row" key={key}>
                <span>{label}</span>
                <div>
                  {groupPlayers.map((player, index) => (
                    <LeaguePlayerToken
                      key={player.id}
                      player={player}
                      shirtCode={shirtCodeFor(player.club, shirtCodes)}
                      position={rowPlayerPosition(index, groupPlayers.length)}
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

function FitClubName({ text }: { text: string }) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useLayoutEffect(() => {
    const heading = headingRef.current
    if (!heading) return
    let frame = 0
    const fit = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        heading.style.fontSize = ''
        const maxFontSize = parseFloat(window.getComputedStyle(heading).fontSize) || 64
        const minFontSize = 14
        let low = minFontSize
        let high = maxFontSize
        heading.style.fontSize = `${maxFontSize}px`
        if (heading.scrollWidth <= heading.clientWidth) return
        while (high - low > 0.5) {
          const next = (low + high) / 2
          heading.style.fontSize = `${next}px`
          if (heading.scrollWidth <= heading.clientWidth) low = next
          else high = next
        }
        heading.style.fontSize = `${Math.max(minFontSize, low)}px`
      })
    }
    const observer = new ResizeObserver(fit)
    observer.observe(heading.parentElement ?? heading)
    fit()
    document.fonts?.ready.then(fit).catch(() => undefined)
    window.addEventListener('resize', fit)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', fit)
    }
  }, [text])

  return (
    <h2 ref={headingRef} title={text}>
      {text}
    </h2>
  )
}

function LeaguePlayerToken({
  player,
  shirtCode,
  position,
  onSelect,
}: {
  player: LeaguePlayer
  shirtCode?: number
  position: { x: number; y: number }
  onSelect: (player: SelectedPlayer) => void
}) {
  const shirtUrl = shirtCode
    ? `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${shirtCode}-110.png`
    : undefined
  return (
    <button
      type="button"
      className="league-player-token"
      style={{ '--x': `${position.x}%`, '--y': `${position.y}%` } as CSSProperties}
      onClick={() => onSelect({ id: player.id, name: player.fullName, shirtUrl })}
      aria-label={`View ${player.fullName} points`}
    >
      <div className="player-core">
        <div className="shirt-wrap">
          {shirtUrl ? (
            <img src={shirtUrl} alt={`${player.club} shirt`} />
          ) : (
            <span>{player.name}</span>
          )}
        </div>
        <div className="player-meta">
          <strong>{player.name}</strong>
          <b>{player.points === 0 && player.minutes === 0 ? '-' : player.points}</b>
        </div>
      </div>
    </button>
  )
}

function rowPlayerPosition(index: number, count: number) {
  if (count === 5 && window.matchMedia('(max-width: 700px)').matches)
    return { x: 10 + index * 20, y: 50 }
  return { x: ((index + 1) / (count + 1)) * 100, y: 50 }
}
