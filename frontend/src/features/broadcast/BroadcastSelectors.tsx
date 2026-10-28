import { Radio } from 'lucide-react'
import { useEffect, useState } from 'react'
import { teamShortName } from './broadcast'
import type { BroadcastFocus, MatchupView, FantasyEventView, TeamView } from './types'

export function MatchSelector({
  matchups,
  latestEvent,
  selectedFocus,
  onSelect,
}: {
  matchups: MatchupView[]
  latestEvent?: FantasyEventView
  selectedFocus: BroadcastFocus
  onSelect: (focus: BroadcastFocus) => void
}) {
  return (
    <nav className="match-selector" aria-label="Ongoing match selector">
      <button
        className={`match-selector-chip multiview-chip ${selectedFocus === 'multi' ? 'selected-match-chip' : ''}`}
        type="button"
        onClick={() => onSelect('multi')}
      >
        <Radio size={14} />
        <span>Multi</span>
      </button>
      <div className="match-chip-track">
        {matchups.map((matchup) => (
          <MatchSelectorChip
            key={matchup.id}
            latestEvent={latestEvent}
            matchup={matchup}
            selected={selectedFocus === matchup.id}
            onSelect={() => onSelect(matchup.id)}
          />
        ))}
      </div>
    </nav>
  )
}

function MatchSelectorChip({
  matchup,
  latestEvent,
  selected,
  onSelect,
}: {
  matchup: MatchupView
  latestEvent?: FantasyEventView
  selected: boolean
  onSelect: () => void
}) {
  const homeChanged = latestEvent?.managerId === matchup.home.managerId
  const awayChanged = latestEvent?.managerId === matchup.away.managerId
  return (
    <button
      className={`match-selector-chip ${selected ? 'selected-match-chip' : ''} ${homeChanged || awayChanged ? 'match-chip-event' : ''}`}
      type="button"
      onClick={onSelect}
    >
      <span className="match-chip-team">{teamShortName(matchup.home)}</span>
      <MatchChipScore
        changed={homeChanged}
        delta={homeChanged && latestEvent ? latestEvent.pointDelta : 0}
        eventId={homeChanged ? latestEvent?.id : undefined}
        score={matchup.home.score}
        side="left"
      />
      <span className="match-chip-separator">-</span>
      <MatchChipScore
        changed={awayChanged}
        delta={awayChanged && latestEvent ? latestEvent.pointDelta : 0}
        eventId={awayChanged ? latestEvent?.id : undefined}
        score={matchup.away.score}
        side="right"
      />
      <span className="match-chip-team">{teamShortName(matchup.away)}</span>
    </button>
  )
}

function MatchChipScore({
  score,
  changed,
  delta,
  eventId,
  side,
}: {
  score: number
  changed: boolean
  delta: number
  eventId?: string
  side: 'left' | 'right'
}) {
  const previousScore = changed ? score - delta : score
  const [displayScore, setDisplayScore] = useState(changed ? previousScore : score)
  useEffect(() => {
    if (!changed || !eventId || delta === 0) {
      const resetTimer = window.setTimeout(() => setDisplayScore(score), 0)
      return () => window.clearTimeout(resetTimer)
    }
    const step = delta > 0 ? 1 : -1
    let timer: number | undefined
    const startTimer = window.setTimeout(() => {
      setDisplayScore(previousScore)
      timer = window.setInterval(
        () => setDisplayScore((value) => (value === score ? value : value + step)),
        120,
      )
    }, 0)
    return () => {
      window.clearTimeout(startTimer)
      if (timer) window.clearInterval(timer)
    }
  }, [changed, delta, eventId, previousScore, score])
  return (
    <div className={`match-chip-score ${changed ? 'changed-score' : ''}`}>
      {side === 'left' && changed && delta !== 0 && (
        <span className="match-chip-delta">
          {delta > 0 ? '+' : ''}
          {delta}
        </span>
      )}
      <span className="match-chip-total">{displayScore}</span>
      {side === 'right' && changed && delta !== 0 && (
        <span className="match-chip-delta">
          {delta > 0 ? '+' : ''}
          {delta}
        </span>
      )}
    </div>
  )
}

export function ClubSelector({
  teams,
  latestEvent,
  selectedFocus,
  onSelect,
}: {
  teams: TeamView[]
  latestEvent?: FantasyEventView
  selectedFocus: BroadcastFocus
  onSelect: (focus: BroadcastFocus) => void
}) {
  return (
    <nav className="match-selector club-selector" aria-label="Ongoing club selector">
      <button
        className={`match-selector-chip multiview-chip ${selectedFocus === 'multi' ? 'selected-match-chip' : ''}`}
        type="button"
        onClick={() => onSelect('multi')}
      >
        <Radio size={14} />
        <span>Multi</span>
      </button>
      <div className="match-chip-track">
        {teams.map((team) => {
          const changed = latestEvent?.managerId === team.managerId
          return (
            <button
              key={team.managerId}
              className={`match-selector-chip club-selector-chip ${selectedFocus === team.managerId ? 'selected-match-chip' : ''} ${changed ? 'match-chip-event' : ''}`}
              type="button"
              onClick={() => onSelect(team.managerId)}
            >
              <span className="match-chip-team">{teamShortName(team)}</span>
              <MatchChipScore
                changed={Boolean(changed)}
                delta={changed ? (latestEvent?.pointDelta ?? 0) : 0}
                eventId={changed ? latestEvent?.id : undefined}
                score={team.score}
                side="right"
              />
            </button>
          )
        })}
      </div>
    </nav>
  )
}
