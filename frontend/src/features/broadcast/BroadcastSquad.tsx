import { Shirt } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { shirtCodeFor } from '../../shared/fpl/shirts'
import type { FplClubShirt } from '../../shared/fpl/types'
import { useShirtCodes } from '../../shared/fpl/useShirtCodes'
import { usePlayerNotification } from './usePlayerNotification'
import type { FantasyEventView, PlayerView, TeamView } from './types'

export function BroadcastSquad({
  team,
  side,
  events,
  pendingEvents,
  shirtCodesOverride,
}: {
  team: TeamView
  side: 'home' | 'away'
  events: FantasyEventView[]
  pendingEvents: FantasyEventView[]
  shirtCodesOverride?: FplClubShirt[]
}) {
  const shirtCodes = useShirtCodes(shirtCodesOverride)
  const squad = useRef<HTMLElement>(null)
  const maxRows = Math.max(
    1,
    team.benchPlayers.length,
    ...['GKP', 'DEF', 'MID', 'FWD'].map(
      (position) => team.activePlayers.filter((player) => player.position === position).length,
    ),
  )
  useLayoutEffect(() => {
    const element = squad.current
    if (!element) return
    const resize = () => {
      const player = element.querySelector<HTMLElement>('.broadcast-player')
      const shirt = player?.querySelector<HTMLElement>('.broadcast-shirt')
      const players = [...element.querySelectorAll<HTMLElement>('.broadcast-player')]
      if (!player || !shirt || !players.length) return
      const metadataHeight = player.offsetHeight - shirt.offsetHeight
      const narrowestCard = Math.min(...players.map((card) => card.clientWidth))
      const height = Math.max(
        24,
        Math.min(180, element.clientHeight / maxRows - metadataHeight - 8, narrowestCard * 1.1),
      )
      element.style.setProperty('--broadcast-shirt-height', `${height}px`)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    resize()
    return () => observer.disconnect()
  }, [maxRows])
  const active = [...team.activePlayers].sort(
    (a, b) =>
      ['FWD', 'MID', 'DEF', 'GKP'].indexOf(a.position) -
      ['FWD', 'MID', 'DEF', 'GKP'].indexOf(b.position),
  )
  const render = (player: PlayerView, bench: boolean, index: number) => {
    const group = bench
      ? team.benchPlayers
      : active.filter((candidate) => candidate.position === player.position)
    const row = bench ? index : group.findIndex((candidate) => candidate.id === player.id)
    const column = bench ? 1 : ['GKP', 'DEF', 'MID', 'FWD'].indexOf(player.position) + 1
    const relevant = (list: FantasyEventView[]) =>
      list.filter((event) => event.managerId === team.managerId && event.playerId === player.id)
    const code = shirtCodeFor(player.premierLeagueClub, shirtCodes)
    return (
      <BroadcastPlayer
        key={`${team.managerId}:${player.id}`}
        player={player}
        managerId={team.managerId}
        bench={bench}
        shirtUrl={
          code
            ? `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${code}-110.png`
            : undefined
        }
        events={relevant(events)}
        pendingDelta={
          events.length
            ? 0
            : relevant(pendingEvents).reduce((sum, event) => sum + event.pointDelta, 0)
        }
        style={
          {
            '--formation-column': side === 'away' && !bench ? 5 - column : column,
            '--formation-y': `${((row + 0.5) / group.length) * 100}%`,
          } as CSSProperties
        }
      />
    )
  }
  return (
    <section
      ref={squad}
      className="broadcast-squad"
      data-side={side}
      data-overflow={active.length + team.benchPlayers.length > 15}
      aria-label={`${team.clubName} players`}
      style={
        {
          '--starter-count': active.length,
          '--bench-count': team.benchPlayers.length,
          '--team-color': team.color,
        } as CSSProperties
      }
    >
      <div className="broadcast-starters">
        {active.map((player, index) => render(player, false, index))}
      </div>
      <span className="broadcast-bench-label">Bench</span>
      <div className="broadcast-bench">
        {team.benchPlayers.map((player, index) => render(player, true, index))}
      </div>
    </section>
  )
}

function BroadcastPlayer({
  player,
  managerId,
  bench,
  shirtUrl,
  events,
  pendingDelta,
  style,
}: {
  player: PlayerView
  managerId: string
  bench: boolean
  shirtUrl?: string
  events: FantasyEventView[]
  pendingDelta: number
  style: CSSProperties
}) {
  const [failedImage, setFailedImage] = useState<string>()
  const { pointsToRender, notificationEventId, activeEvents, notificationLeaving } =
    usePlayerNotification(player.points, events, pendingDelta)
  const delta = activeEvents.reduce((sum, event) => sum + event.pointDelta, 0)
  const points = pointsToRender === 0 && (player.minutes ?? 0) === 0 ? '–' : pointsToRender
  return (
    <button
      type="button"
      className={`broadcast-player ${bench ? 'is-bench' : ''} ${notificationEventId ? 'has-event' : ''} ${delta < 0 ? 'negative-event' : ''} ${notificationLeaving ? 'is-leaving' : ''}`}
      style={style}
      aria-label={`View ${player.displayName} points`}
      data-player-id={player.id}
      data-manager-id={managerId}
      data-player-name={player.displayName}
      data-shirt-url={shirtUrl}
      data-player-points={pointsToRender}
    >
      <span className="broadcast-shirt" aria-hidden="true">
        {shirtUrl && failedImage !== shirtUrl ? (
          <img src={shirtUrl} alt="" onError={() => setFailedImage(shirtUrl)} />
        ) : (
          <Shirt />
        )}
      </span>
      <span className="broadcast-player-main">
        <span className="broadcast-player-name">{player.shortName ?? player.displayName}</span>
        <span className="broadcast-player-status">
          {bench ? 'B' : player.autoSubstituted ? 'SUB' : player.position}
        </span>
        <span className="broadcast-player-points">{points}</span>
        <span className="broadcast-player-event" aria-hidden="true">
          <span>
            {activeEvents[0]?.type.replaceAll('_', ' ')}
            {activeEvents.length > 1 && <small> +{activeEvents.length - 1}</small>}
          </span>
          <b>{notificationEventId && delta !== 0 ? `${delta > 0 ? '+' : ''}${delta} pts` : ''}</b>
        </span>
      </span>
    </button>
  )
}
