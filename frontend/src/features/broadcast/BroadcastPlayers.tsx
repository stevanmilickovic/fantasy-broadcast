import type { CSSProperties } from 'react'
import { usePlayerNotification } from './usePlayerNotification'
import { playerCardName } from './broadcast'
import { displayPlayerPoints, notificationWidthFor } from './playerLayout'
import type { PlayerView, FantasyEventView } from './types'

const notificationTopFor = (index: number) => {
  const metadataHeight = window.matchMedia('(max-width: 900px)').matches ? 20 : 26
  return 29 + index * (metadataHeight - 1)
}

export function BenchPlayer({
  player,
  teamColor,
  shirtCode,
  verticalPosition,
  events,
  pendingPointDelta,
  notificationShift,
}: {
  player: PlayerView
  teamColor: string
  shirtCode?: number
  verticalPosition: { y: number; yOffset: number }
  events: FantasyEventView[]
  pendingPointDelta: number
  notificationShift: number
}) {
  const name = playerCardName(player).join(' ').trim()
  const shirtUrl = shirtCode
    ? `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${shirtCode}-66.png`
    : undefined
  const { activeEvents, activeEvent, notificationEventId, notificationLeaving, pointsToRender } =
    usePlayerNotification(player.points, events, pendingPointDelta)
  const eventWidth = Math.max(108, ...activeEvents.map(notificationWidthFor))
  const metadataWidth = 26 + Math.min(82, Math.max(34, name.length * 6 + 12))
  const style = {
    '--team-color': teamColor,
    '--y': `${verticalPosition.y}%`,
    '--y-offset': `${verticalPosition.yOffset}px`,
    '--event-width': `${eventWidth}px`,
    '--metadata-width': `${metadataWidth}px`,
    '--event-shift': `${notificationShift}px`,
  } as CSSProperties
  return (
    <div
      className={`bench-player ${activeEvent ? 'has-event' : ''}`}
      style={style}
      role="button"
      tabIndex={0}
      aria-label={`View ${player.displayName} points`}
      data-player-id={player.id}
      data-player-name={player.displayName}
      data-shirt-url={shirtUrl}
      data-player-points={player.points}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          event.currentTarget.click()
        }
      }}
    >
      <div
        className={`player-token bench-player-token ${activeEvent ? 'has-event' : ''} ${notificationLeaving ? 'is-leaving' : ''}`}
      >
        <div className="player-core">
          <div className="shirt-wrap">
            {shirtUrl ? (
              <img src={shirtUrl} alt={`${player.premierLeagueClub} shirt`} />
            ) : (
              <span>{name}</span>
            )}
          </div>
          <div
            className={`player-event-stack ${activeEvent ? 'has-event' : ''} ${notificationLeaving ? 'is-leaving' : ''}`}
          >
            <div className="player-meta">
              <strong>{name}</strong>
              <b>{displayPlayerPoints(player, pointsToRender)}</b>
            </div>
            {activeEvent &&
              notificationEventId === activeEvent.id &&
              activeEvents.map((candidate, index) => (
                <span
                  key={candidate.id}
                  className={`player-event-notification ${notificationLeaving ? 'is-leaving' : ''}`}
                  style={
                    {
                      '--notification-top': `${notificationTopFor(index)}px`,
                      '--notification-delay': `${index * 140}ms`,
                    } as CSSProperties
                  }
                >
                  <strong>{candidate.type.replaceAll('_', ' ')}</strong>
                  <span>
                    {candidate.pointDelta > 0 ? '+' : ''}
                    {candidate.pointDelta} pts
                  </span>
                </span>
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function PitchPlayer({
  player,
  side,
  teamColor,
  position,
  shirtCode,
  events,
  pendingPointDelta = 0,
  notificationShift,
  compactLane,
}: {
  player: PlayerView
  side: 'home' | 'away'
  teamColor: string
  position: { x: number; y: number; yOffset: number }
  shirtCode?: number
  events: FantasyEventView[]
  pendingPointDelta?: number
  notificationShift: number
  compactLane?: 'outer' | 'inner'
}) {
  const name = playerCardName(player).join(' ').trim()
  const shirtUrl = shirtCode
    ? `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${shirtCode}-110.png`
    : undefined
  const style = {
    '--x': `${position.x}%`,
    '--y': `${position.y}%`,
    '--y-offset': `${position.yOffset}px`,
    '--team-color': teamColor,
  } as CSSProperties
  const { activeEvents, activeEvent, notificationEventId, notificationLeaving, pointsToRender } =
    usePlayerNotification(player.points, events, pendingPointDelta)
  // This is based on the actual notification content, not a one-size event card.
  const eventWidth = Math.max(108, ...activeEvents.map(notificationWidthFor))
  const metadataWidth = 26 + Math.min(82, Math.max(34, name.length * 6 + 12))
  const eventStyle = {
    '--event-width': `${eventWidth}px`,
    '--metadata-width': `${metadataWidth}px`,
    '--event-shift': `${notificationShift}px`,
  } as CSSProperties
  return (
    <div
      className={`pitch-player ${side} ${compactLane ? `compact-lane-${compactLane}` : ''} ${activeEvent ? 'has-event' : ''} ${player.autoSubstituted ? 'auto-substituted' : ''}`}
      style={style}
      role="button"
      tabIndex={0}
      aria-label={`View ${player.displayName} points`}
      data-player-id={player.id}
      data-player-name={player.displayName}
      data-shirt-url={shirtUrl}
      data-player-points={player.points}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          event.currentTarget.click()
        }
      }}
    >
      <div
        className={`player-token ${activeEvent ? 'has-event' : ''} ${notificationLeaving ? 'is-leaving' : ''}`}
      >
        <div className="player-core">
          <div className="shirt-wrap">
            {shirtUrl ? (
              <img src={shirtUrl} alt={`${player.premierLeagueClub} shirt`} />
            ) : (
              <span>{name}</span>
            )}
          </div>
          <div
            className={`player-event-stack ${activeEvent ? 'has-event' : ''} ${notificationLeaving ? 'is-leaving' : ''}`}
            style={activeEvent ? eventStyle : undefined}
          >
            <div className="player-meta">
              <strong>{name}</strong>
              <b>{displayPlayerPoints(player, pointsToRender)}</b>
            </div>
            {activeEvent &&
              notificationEventId === activeEvent.id &&
              activeEvents.map((candidate, index) => (
                <span
                  key={candidate.id}
                  className={`player-event-notification ${notificationLeaving ? 'is-leaving' : ''}`}
                  style={
                    {
                      '--notification-top': `${notificationTopFor(index)}px`,
                      '--notification-delay': `${index * 140}ms`,
                    } as CSSProperties
                  }
                >
                  <strong>{candidate.type.replaceAll('_', ' ')}</strong>
                  <span>
                    {candidate.pointDelta > 0 ? '+' : ''}
                    {candidate.pointDelta} pts
                  </span>
                </span>
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}
