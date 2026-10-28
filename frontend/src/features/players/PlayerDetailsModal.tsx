import { useDialogMotion } from '../../shared/ui/useDialogMotion'
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { loadPlayerDetails } from './api'
import type { PlayerDetails } from './types'

export type SelectedPlayer = {
  id: number | string
  name: string
  shirtUrl?: string
  points?: number
}

export function PlayerDetailsModal({
  player,
  leagueId,
  gameweek,
  onClose,
}: {
  player: SelectedPlayer
  leagueId?: number
  gameweek: number
  onClose: () => void
}) {
  const { dialog: dialogRef, closing, close, show, onClose: handleNativeClose } = useDialogMotion()
  const [details, setDetails] = useState<PlayerDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'current' | 'history'>('current')

  useEffect(() => {
    show()
  }, [show])
  const dismiss = () => close(onClose)

  useEffect(() => {
    if (!leagueId || !Number.isSafeInteger(Number(player.id)) || Number(player.id) <= 0) return
    const controller = new AbortController()
    void loadPlayerDetails(leagueId, Number(player.id), gameweek, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setDetails(result)
      })
      .catch((reason: Error) => {
        if (!controller.signal.aborted) setError(reason.message)
      })
    return () => controller.abort()
  }, [leagueId, player.id, gameweek])

  const photoUrl = details?.photoCode
    ? `https://resources.premierleague.com/premierleague/photos/players/110x140/p${details.photoCode}.png`
    : undefined

  return (
    <dialog
      ref={dialogRef}
      className="player-details-modal dialog-motion"
      data-closing={closing}
      onClose={handleNativeClose}
      onCancel={(event) => {
        event.preventDefault()
        dismiss()
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) dismiss()
      }}
    >
      <div className="player-details-content">
        <button
          className="player-details-close"
          type="button"
          onClick={dismiss}
          aria-label="Close player details"
        >
          <X size={22} />
        </button>
        <header className="player-details-header">
          <div className="player-details-photo">
            <span>{(details?.shortName ?? player.name).slice(0, 1)}</span>
            {photoUrl && (
              <img
                src={photoUrl}
                alt=""
                onError={(event) => {
                  event.currentTarget.hidden = true
                }}
              />
            )}
          </div>
          <div className="player-details-heading">
            <span>
              {details?.club ?? 'Premier League player'} · {details?.position ?? ''}
            </span>
            <h2>{details?.name ?? player.name}</h2>
          </div>
          {player.shirtUrl && (
            <img
              className="player-details-shirt"
              src={player.shirtUrl}
              alt={`${details?.club ?? 'Club'} shirt`}
            />
          )}
        </header>
        <div className="player-details-tabs" role="tablist" aria-label="Player points">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'current'}
            className={tab === 'current' ? 'selected' : ''}
            onClick={() => setTab('current')}
          >
            Gameweek {gameweek}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'history'}
            className={tab === 'history' ? 'selected' : ''}
            onClick={() => setTab('history')}
          >
            Previous gameweeks
          </button>
        </div>
        {error && <p className="player-details-message">{error}</p>}
        {!details && !error && (
          <p className="player-details-message">
            {leagueId
              ? 'Loading player points…'
              : 'Detailed point history is available for registered league broadcasts.'}
          </p>
        )}
        {details && tab === 'current' && (
          <div className="player-details-list" role="tabpanel">
            <div className="player-details-total">
              <span>Total</span>
              <strong>{details.points} pts</strong>
            </div>
            {details.changes.length === 0 ? (
              <p>No point changes recorded this gameweek.</p>
            ) : (
              details.changes.map((change, index) => (
                <div
                  className="player-details-row"
                  key={`${change.fixture}-${change.stat}-${index}`}
                >
                  <span>
                    {pointLabel(change.stat)}
                    {change.value > 1 ? ` × ${change.value}` : ''}
                  </span>
                  <strong>
                    {change.points > 0 ? '+' : ''}
                    {change.points}
                  </strong>
                </div>
              ))
            )}
          </div>
        )}
        {details && tab === 'history' && (
          <div className="player-details-list player-details-history" role="tabpanel">
            {details.history.length === 0 ? (
              <p>No previous gameweek points yet.</p>
            ) : (
              [...details.history].reverse().map((week) => (
                <div className="player-details-row" key={week.gameweek}>
                  <span>Gameweek {week.gameweek}</span>
                  <strong>{week.points} pts</strong>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </dialog>
  )
}

function pointLabel(stat: string) {
  return stat.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}
