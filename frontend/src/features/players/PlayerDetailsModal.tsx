import { useDialogMotion } from '../../shared/ui/useDialogMotion'
import { useEffect, useId, useReducer, useState } from 'react'
import { X } from 'lucide-react'
import { loadPlayerDetails } from './api'
import type { PlayerDetails } from './types'
import { playerAvailability } from '../../shared/fpl/availability'
import { PlayerFixtures } from './PlayerFixtures'
import { PlayerGameweek } from './PlayerGameweek'

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
  const [tab, setTab] = useState<'current' | 'fixtures' | 'history'>('current')
  const tabId = useId()
  const tabs = [
    { id: 'current', label: `Gameweek ${gameweek}` },
    { id: 'fixtures', label: 'Upcoming fixtures' },
    { id: 'history', label: 'Previous gameweeks' },
  ] as const

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
          {tabs.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`${tabId}-${item.id}`}
              aria-controls={`${tabId}-panel`}
              aria-selected={tab === item.id}
              tabIndex={tab === item.id ? 0 : -1}
              className={tab === item.id ? 'selected' : ''}
              onClick={() => setTab(item.id)}
              onKeyDown={(event) => {
                const next =
                  event.key === 'ArrowRight'
                    ? (index + 1) % tabs.length
                    : event.key === 'ArrowLeft'
                      ? (index + tabs.length - 1) % tabs.length
                      : event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? tabs.length - 1
                          : undefined
                if (next === undefined) return
                event.preventDefault()
                setTab(tabs[next].id)
                document.getElementById(`${tabId}-${tabs[next].id}`)?.focus()
              }}
            >
              {item.label}
            </button>
          ))}
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
          <div
            className="player-details-list"
            role="tabpanel"
            id={`${tabId}-panel`}
            aria-labelledby={`${tabId}-current`}
          >
            <PlayerGameweek details={details} />
          </div>
        )}
        {details && tab === 'fixtures' && (
          <div
            className="player-details-list"
            role="tabpanel"
            id={`${tabId}-panel`}
            aria-labelledby={`${tabId}-fixtures`}
          >
            <PlayerFixtures schedule={details.fixtureSchedule} />
          </div>
        )}
        {details && tab === 'history' && (
          <div
            className="player-details-list player-details-history"
            role="tabpanel"
            id={`${tabId}-panel`}
            aria-labelledby={`${tabId}-history`}
          >
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
