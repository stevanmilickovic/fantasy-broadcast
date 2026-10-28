import { Sparkles, Volume2, X } from 'lucide-react'
import { useId } from 'react'
import { useDialogMotion } from '../../shared/ui/useDialogMotion'
import type { FantasyEventView, TeamView } from './types'

export function BroadcastEventRail({
  events,
  teams,
  text,
  status,
}: {
  events: FantasyEventView[]
  teams: TeamView[]
  text: string
  status: string
}) {
  const { dialog, show, closing, close, onClose } = useDialogMotion()
  const title = useId()
  const commentary = status !== 'WAITING' && Boolean(text.trim())
  const first = events[0]
  const eventText = (event: FantasyEventView) => {
    const team = teams.find((candidate) => candidate.managerId === event.managerId)
    const player = [...(team?.activePlayers ?? []), ...(team?.benchPlayers ?? [])].find(
      (candidate) => candidate.id === event.playerId,
    )
    return `${team?.clubName ?? 'Club'} · ${player?.shortName ?? player?.displayName ?? 'Player'} · ${event.type.replaceAll('_', ' ')} ${event.pointDelta > 0 ? '+' : ''}${event.pointDelta} pts`
  }
  if (!commentary && !first) return null
  return (
    <aside
      className="broadcast-event-rail"
      aria-label="Broadcast updates"
      data-commentary={commentary}
      data-events={Boolean(first)}
    >
      {first && (
        <div className="broadcast-event-line" aria-live="polite" aria-atomic="true">
          <span className="broadcast-event-summary">
            {eventText(first)}
            {events.length > 1 && <span> · +{events.length - 1} events</span>}
          </span>
          {!commentary && (
            <button type="button" onClick={show} aria-label="Read full broadcast update">
              Details
            </button>
          )}
        </div>
      )}
      {commentary && (
        <div className="broadcast-caption">
          <CommentaryIcons />
          <span>{text}</span>
          <button type="button" onClick={show} aria-label="Read full broadcast update">
            Details
          </button>
        </div>
      )}
      <dialog
        ref={dialog}
        className="broadcast-picker broadcast-update-dialog dialog-motion"
        data-closing={closing}
        aria-labelledby={title}
        onClose={onClose}
        onCancel={(event) => {
          event.preventDefault()
          close()
        }}
        onClick={(event) => {
          if (event.target === dialog.current) close()
        }}
      >
        <header>
          <h2 id={title}>Broadcast update</h2>
          <button type="button" aria-label="Close broadcast update" onClick={() => close()}>
            <X size={20} />
          </button>
        </header>
        <div className="broadcast-update-content">
          {events.length > 0 && (
            <ul>
              {events.map((event) => (
                <li key={event.id}>{eventText(event)}</li>
              ))}
            </ul>
          )}
          {commentary && (
            <>
              <CommentaryIcons />
              <p>{text}</p>
            </>
          )}
        </div>
      </dialog>
    </aside>
  )
}

function CommentaryIcons() {
  return (
    <span className="broadcast-commentary-icons" role="img" aria-label="AI-generated commentary">
      <Volume2 size={16} aria-hidden="true" />
      <Sparkles size={14} aria-hidden="true" />
    </span>
  )
}
