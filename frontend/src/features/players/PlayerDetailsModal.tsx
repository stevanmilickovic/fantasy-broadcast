import { useDialogMotion } from '../../shared/ui/useDialogMotion'
import { useEffect, useReducer, useState } from 'react'
import { X } from 'lucide-react'
import { loadPlayerDetails } from './api'
import type { PlayerDetails } from './types'
import { playerAvailability } from '../../shared/fpl/availability'
import { PlayerFixtures } from './PlayerFixtures'

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
  const [snapshot, setDetails] = useState<PlayerDetails | null>(null)
  const details =
    snapshot?.id === Number(player.id) && snapshot.gameweek === gameweek ? snapshot : null
  const [error, setError] = useState<string | null>(null)
  const [revision, retry] = useReducer((value) => value + 1, 0)
  const [tab, setTab] = useState<'current' | 'history'>('current')

  useEffect(() => {
    show()
  }, [show])
  const dismiss = () => close(onClose)

  useEffect(() => {
    if (!leagueId || !Number.isSafeInteger(Number(player.id)) || Number(player.id) <= 0) return
    let controller: AbortController | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let stopped = false
    const load = () => {
      clearTimeout(timer)
      controller?.abort()
      if (document.hidden || stopped) return
      const request = new AbortController()
      controller = request
      void loadPlayerDetails(leagueId, Number(player.id), gameweek, request.signal)
        .then((result) => {
          if (!request.signal.aborted) {
            setDetails(result)
            setError(null)
          }
        })
        .catch((reason: Error) => {
          if (!request.signal.aborted) setError(reason.message)
        })
        .finally(() => {
          if (!request.signal.aborted && !stopped) timer = setTimeout(load, 30_000)
        })
    }
    load()
    document.addEventListener('visibilitychange', load)
    window.addEventListener('focus', load)
    return () => {
      stopped = true
      clearTimeout(timer)
      controller?.abort()
      document.removeEventListener('visibilitychange', load)
      window.removeEventListener('focus', load)
    }
  }, [leagueId, player.id, gameweek, revision])

  const photoUrl = details?.photoCode
    ? `https://resources.premierleague.com/premierleague/photos/players/110x140/p${details.photoCode}.png`
    : undefined
  const availability = playerAvailability(details?.availability)

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
        {details?.availability && (
          <section
            className="player-availability"
            data-availability={availability.severity}
            aria-label="Current availability"
          >
            <strong>{availability.label}</strong>
            {availability.chance !== null && (
              <p>
                {availability.chance}% chance of playing {availability.round} gameweek
              </p>
            )}
            {availability.chance === null && availability.severity && (
              <p>Playing percentage not provided by FPL.</p>
            )}
            {details.availability.news && <p>{details.availability.news}</p>}
          </section>
        )}
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
        {error && (
          <p className="player-details-message" role="alert">
            {details && 'Update failed. Showing last received details. '}
            {error}{' '}
            <button type="button" onClick={retry}>
              Retry player details
            </button>
          </p>
        )}
        {!details && !error && (
          <p className="player-details-message">
            {leagueId
              ? 'Loading player points…'
              : 'Detailed points and fixtures are available in registered league views.'}
          </p>
        )}
        {details && tab === 'current' && (
          <div className="player-details-list" role="tabpanel">
            <div className="player-details-total">
              <span>Total</span>
              <strong>{details.points === null ? '—' : `${details.points} pts`}</strong>
            </div>
            <PlayerFixtures
              schedule={details.fixtureSchedule}
              gameweek={gameweek}
              club={details.club}
            />
            {details.changes.length === 0 ? (
              <p>No point changes recorded this gameweek.</p>
            ) : (
              details.changes.map((change, index) => (
                <div key={`${change.fixture}-${change.stat}-${index}`}>
                  {details.fixtureSchedule &&
                    details.fixtureSchedule.current.length > 1 &&
                    (index === 0 || details.changes[index - 1].fixture !== change.fixture) && (
                      <h3 className="player-breakdown-fixture">
                        {details.fixtureSchedule.current.find(
                          (fixture) => fixture.id === change.fixture,
                        )?.opponent ?? `Fixture ${change.fixture}`}
                      </h3>
                    )}
                  <div className="player-details-row">
                    <span>
                      {pointLabel(change.stat)}
                      {change.value > 1 ? ` × ${change.value}` : ''}
                    </span>
                    <strong>
                      {change.points > 0 ? '+' : ''}
                      {change.points}
                    </strong>
                  </div>
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
