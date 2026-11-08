import { Shirt } from 'lucide-react'
import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { shirtCodeFor, shirtUrlFor } from '../../shared/fpl/shirts'
import type { FplClubShirt } from '../../shared/fpl/types'
import { useShirtCodes } from '../../shared/fpl/useShirtCodes'
import { usePlayerNotification } from './usePlayerNotification'
import { playerAvailability } from '../../shared/fpl/availability'
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
        Math.min(180, element.clientHeight / 4 - metadataHeight - 8, narrowestCard * 1.1),
      )
      element.style.setProperty('--broadcast-shirt-height', `${height}px`)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    resize()
    return () => observer.disconnect()
  }, [])
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
        shirtUrl={shirtUrlFor(code, player.position)}
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
  const availability = playerAvailability(player.availability)
  const descriptionId = useId()
  const progress = player.fixtureProgress ?? 'UNKNOWN'
  const progressLabel = {
    UPCOMING: 'Team yet to play this gameweek',
    LIVE: 'Team playing now',
    BETWEEN: 'Another club fixture remains this gameweek',
    COMPLETE: 'Club fixtures complete this gameweek',
    BLANK: 'No club fixture scheduled this gameweek',
    TBD: 'Club fixture schedule to be confirmed',
    UNKNOWN: 'Club fixture progress unavailable',
  }[progress]
  const { pointsToRender, notificationEventId, activeEvents, notificationLeaving } =
    usePlayerNotification(player.points, events, pendingDelta)
  const delta = activeEvents.reduce((sum, event) => sum + event.pointDelta, 0)
  const eventLabel = activeEvents.map((event) => event.type.replaceAll('_', ' ')).join(', ')
  const points =
    pointsToRender === 0 &&
    (player.minutes ?? 0) === 0 &&
    progress !== 'COMPLETE' &&
    progress !== 'BETWEEN' &&
    progress !== 'LIVE'
      ? '–'
      : pointsToRender
  return (
    <button
      type="button"
      className={`broadcast-player ${bench ? 'is-bench' : ''} ${notificationEventId ? 'has-event' : ''} ${delta < 0 ? 'negative-event' : ''} ${notificationLeaving ? 'is-leaving' : ''}`}
      style={style}
      aria-label={`View ${player.displayName} points${availability.severity ? ` — ${availability.label}` : ''}`}
      data-availability={availability.severity}
      data-fixture-progress={progress}
      aria-describedby={descriptionId}
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
        {(progress === 'LIVE' || progress === 'BETWEEN') && (
          <span className="broadcast-fixture-marker">{progress === 'LIVE' ? 'LIVE' : 'DGW'}</span>
        )}
      </span>
      <span id={descriptionId} className="broadcast-fixture-description">
        {progressLabel}
      </span>
      <span className="broadcast-player-main">
        <span className="broadcast-player-name">{player.shortName ?? player.displayName}</span>
        <span className="broadcast-player-status">
          {bench ? 'B' : player.autoSubstituted ? 'SUB' : player.position}
        </span>
        <span className={`broadcast-player-points ${points === '–' ? 'is-empty' : ''}`}>
          {points}
        </span>
        <span className="broadcast-player-event" aria-hidden="true">
          <span title={eventLabel}>{eventLabel}</span>
          <b>{notificationEventId && delta !== 0 ? `${delta > 0 ? '+' : ''}${delta} pts` : ''}</b>
        </span>
      </span>
    </button>
  )
}
