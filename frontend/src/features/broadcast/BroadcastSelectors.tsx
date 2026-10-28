import { Check, ChevronDown, Radio, X } from 'lucide-react'
import { useId } from 'react'
import { formatScoreline } from './broadcast'
import { useDialogMotion } from '../../shared/ui/useDialogMotion'
import type { BroadcastFocus, FantasyEventView, MatchupView, TeamView } from './types'

type Choice = { id: string; label: string; score: string }
export function BroadcastSelectors({
  matchups,
  teams,
  pendingEvents,
  selectedFocus,
  automaticFocus,
  onSelect,
}: {
  matchups: MatchupView[]
  teams: TeamView[]
  pendingEvents: FantasyEventView[]
  selectedFocus: BroadcastFocus
  automaticFocus: BroadcastFocus
  onSelect: (focus: BroadcastFocus) => void
}) {
  const points = (team: TeamView) =>
    team.score -
    pendingEvents
      .filter((event) => event.managerId === team.managerId)
      .reduce((sum, event) => sum + event.pointDelta, 0)
  const choices: Choice[] = matchups.length
    ? matchups.map((match) => ({
        id: match.id,
        label: `${match.home.clubName} · ${match.away.clubName}`,
        score: formatScoreline(`${points(match.home)}-${points(match.away)}`),
      }))
    : teams.map((team) => ({
        id: team.managerId,
        label: team.clubName,
        score: `${points(team)} pts`,
      }))
  const current = choices.find(
    (choice) => choice.id === (selectedFocus === 'multi' ? automaticFocus : selectedFocus),
  )
  const { dialog, show, open, closing, close, onClose } = useDialogMotion()
  const titleId = useId()
  return (
    <nav
      className="broadcast-selectors"
      aria-label={`Ongoing ${matchups.length ? 'match' : 'club'} selector`}
    >
      <button
        type="button"
        className="broadcast-auto"
        aria-pressed={selectedFocus === 'multi'}
        onClick={() => onSelect('multi')}
      >
        <Radio size={14} />
        Multi
      </button>
      <div className="broadcast-chip-viewport">
        <div className="match-chip-track">
          {choices.map((choice) => (
            <button
              type="button"
              key={choice.id}
              aria-pressed={selectedFocus === choice.id}
              data-current={automaticFocus === choice.id}
              onClick={() => onSelect(choice.id)}
            >
              <span>{choice.label}</span>
              <b>{choice.score}</b>
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="broadcast-picker-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Choose ${matchups.length ? 'match' : 'club'}`}
        onClick={() => {
          show()
          dialog.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus()
        }}
      >
        <span>{current?.label ?? 'Choose focus'}</span>
        <ChevronDown size={16} />
      </button>
      <dialog
        ref={dialog}
        className="broadcast-picker dialog-motion"
        data-closing={closing}
        aria-labelledby={titleId}
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
          <h2 id={titleId}>Broadcast focus</h2>
          <button type="button" aria-label="Close broadcast focus" onClick={() => close()}>
            <X size={20} />
          </button>
        </header>
        <div className="broadcast-picker-options">
          {[{ id: 'multi', label: 'Multi · follow the broadcast', score: '' }, ...choices].map(
            (choice, index) => (
              <button
                type="button"
                key={choice.id}
                aria-pressed={selectedFocus === choice.id}
                onClick={() => close(() => onSelect(choice.id))}
                onKeyDown={(event) => {
                  const buttons =
                    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')
                  if (!buttons) return
                  const next =
                    event.key === 'ArrowDown'
                      ? (index + 1) % buttons.length
                      : event.key === 'ArrowUp'
                        ? (index + buttons.length - 1) % buttons.length
                        : event.key === 'Home'
                          ? 0
                          : event.key === 'End'
                            ? buttons.length - 1
                            : undefined
                  if (next !== undefined) {
                    event.preventDefault()
                    buttons[next]?.focus()
                  }
                }}
              >
                <span>
                  {choice.label}
                  <small>{choice.score}</small>
                </span>
                {selectedFocus === choice.id && <Check size={18} />}
              </button>
            ),
          )}
        </div>
      </dialog>
    </nav>
  )
}
