import { ArrowLeft, Radio, Trophy } from 'lucide-react'
import type { CSSProperties, RefObject } from 'react'
import { useEffect, useState } from 'react'
import type { BroadcastFocus, FantasyEventView, LiveStateResponse, MatchupView, RevealLayout, TeamView } from '../../types/live'
import {
  formatScoreline,
  matchupHasEvent,
  playerCardName,
  playerGroupsForTeam,
  revealCopyStyle,
  teamShortName,
} from '../../utils/broadcast'

type BroadcastMatchdayProps = {
  displayLiveState: LiveStateResponse
  matchup: MatchupView
  latestCommentaryText: string
  latestCommentaryStatus: string
  leaderName: string
  broadcastFocus: BroadcastFocus
  revealingMatch: boolean
  revealLayout: RevealLayout | null
  transitioningToMatch: boolean
  visibleEventId: string | null
  homeHeadingRef: RefObject<HTMLHeadingElement | null>
  awayHeadingRef: RefObject<HTMLHeadingElement | null>
  scoreRef: RefObject<HTMLElement | null>
  onBack: () => void
  onSelectFocus: (focus: BroadcastFocus) => void
}

export function BroadcastMatchday({
  displayLiveState,
  matchup,
  latestCommentaryText,
  latestCommentaryStatus,
  leaderName,
  broadcastFocus,
  revealingMatch,
  revealLayout,
  transitioningToMatch,
  visibleEventId,
  homeHeadingRef,
  awayHeadingRef,
  scoreRef,
  onBack,
  onSelectFocus,
}: BroadcastMatchdayProps) {
  const displayLatestEvent = displayLiveState.events[0]
  const eventBelongsToDisplayedMatchup = matchupHasEvent(matchup, displayLatestEvent)
  const displayEvent =
    eventBelongsToDisplayedMatchup && visibleEventId === displayLatestEvent?.id ? displayLatestEvent : undefined
  const pendingEvent = eventBelongsToDisplayedMatchup && !displayEvent ? displayLatestEvent : undefined

  return (
    <main className={`broadcast-shell matchday-page ${revealingMatch ? 'revealing-match' : ''}`}>
      {transitioningToMatch && <div className="scene-wipe-overlay" aria-hidden="true" />}
      {revealingMatch && <MatchReveal layout={revealLayout} matchup={matchup} />}
      <button className="floating-back" type="button" onClick={onBack}>
        <ArrowLeft size={18} />
        Back
      </button>
      <div className="live-indicator">
        <Radio size={16} />
        <span>Live</span>
      </div>
      <MatchSelector
        latestEvent={displayLatestEvent}
        matchups={displayLiveState.matchups}
        selectedFocus={broadcastFocus}
        onSelect={onSelectFocus}
      />

      <section className="matchday-stage" aria-label="Focused matchup broadcast">
        <BroadcastTeamColumn
          side="left"
          team={matchup.home}
          latestEvent={displayEvent}
          pendingEvent={pendingEvent}
          isLeader={matchup.leaderManagerId === matchup.home.managerId}
          headingRef={homeHeadingRef}
        />
        <MatchPitch
          gameweek={displayLiveState.gameweek}
          scoreline={matchup.scoreline}
          leaderName={leaderName}
          latestEvent={displayEvent}
          scoreRef={scoreRef}
        />
        <BroadcastTeamColumn
          side="right"
          team={matchup.away}
          latestEvent={displayEvent}
          pendingEvent={pendingEvent}
          isLeader={matchup.leaderManagerId === matchup.away.managerId}
          headingRef={awayHeadingRef}
        />
      </section>

      <section className="panel commentary-panel">
        <div className="panel-heading">
          <h2>Now On Air</h2>
          <span>{latestCommentaryStatus}</span>
        </div>
        <blockquote>{latestCommentaryText}</blockquote>
      </section>
    </main>
  )
}

function MatchSelector({
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
  const [showDelta, setShowDelta] = useState(changed)

  useEffect(() => {
    if (!changed || !eventId || delta === 0) {
      setDisplayScore(score)
      setShowDelta(false)
      return
    }

    setDisplayScore(previousScore)
    setShowDelta(true)

    const direction = delta > 0 ? 1 : -1
    const steps = Math.abs(delta)
    let currentStep = 0
    const countTimer = window.setInterval(() => {
      currentStep += 1
      setDisplayScore(previousScore + currentStep * direction)
      if (currentStep >= steps) {
        window.clearInterval(countTimer)
      }
    }, 120)
    const deltaTimer = window.setTimeout(() => setShowDelta(false), 5000)

    return () => {
      window.clearInterval(countTimer)
      window.clearTimeout(deltaTimer)
    }
  }, [changed, delta, eventId, previousScore, score])

  const deltaElement = showDelta && (
    <span className="match-chip-delta">
      {delta > 0 ? '+' : ''}
      {delta}
    </span>
  )

  return (
    <div className={`match-chip-score ${changed ? 'changed-score' : ''}`}>
      {side === 'left' && deltaElement}
      <span className="match-chip-total">{displayScore}</span>
      {side === 'right' && deltaElement}
    </div>
  )
}

function BroadcastTeamColumn({
  side,
  team,
  latestEvent,
  pendingEvent,
  isLeader,
  headingRef,
}: {
  side: 'left' | 'right'
  team: TeamView
  latestEvent?: FantasyEventView
  pendingEvent?: FantasyEventView
  isLeader: boolean
  headingRef: RefObject<HTMLHeadingElement | null>
}) {
  const teamStyle: CSSProperties & Record<'--team-color', string> = {
    '--team-color': team.color,
  }
  const playerGroups = playerGroupsForTeam(team)

  return (
    <section className={`broadcast-team-column ${side}`} style={teamStyle}>
      <div className="broadcast-team-heading">
        <span>{teamShortName(team)}</span>
        <h2 ref={headingRef}>{team.clubName}</h2>
        <p>{team.displayName}</p>
        <strong className={isLeader ? '' : 'leader-placeholder'}>Leading</strong>
      </div>
      <div className="broadcast-player-board">
        {playerGroups.map((group) => (
          <div className={`broadcast-position-row ${group.key === 'BENCH' ? 'bench-row' : ''}`} key={group.key}>
            <span className="position-row-label">{group.label}</span>
            <div className="position-player-row">
              {group.players.map((player) => {
                const isChangedPlayer = latestEvent?.managerId === team.managerId && latestEvent.playerId === player.id
                const isPendingPlayer =
                  pendingEvent?.managerId === team.managerId && pendingEvent.playerId === player.id
                const pointEvent = latestEvent ?? pendingEvent
                const [firstName, surname] = playerCardName(player)
                const previousPoints =
                  (isChangedPlayer || isPendingPlayer) && pointEvent ? player.points - pointEvent.pointDelta : player.points
                const renderedPoints = isPendingPlayer ? previousPoints : player.points
                return (
                  <div
                    className={`broadcast-player-card ${isChangedPlayer ? 'broadcast-player-event' : ''}`}
                    key={player.id}
                  >
                    <div className="broadcast-player-name">
                      <strong>{firstName}</strong>
                      {surname && <strong>{surname}</strong>}
                    </div>
                    <PlayerPoints
                      key={isChangedPlayer ? `${latestEvent.id}-${player.id}-${player.points}` : `${player.id}-${renderedPoints}`}
                      points={renderedPoints}
                      previousPoints={previousPoints}
                      delta={isChangedPlayer ? latestEvent.pointDelta : 0}
                      eventId={isChangedPlayer ? latestEvent.id : undefined}
                    />
                    {isChangedPlayer && (
                      <div className="broadcast-player-notification">
                        <strong>{latestEvent.type.replaceAll('_', ' ')}</strong>
                        <span>
                          {latestEvent.pointDelta > 0 ? '+' : ''}
                          {latestEvent.pointDelta} pts
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function PlayerPoints({
  points,
  previousPoints,
  delta,
  eventId,
}: {
  points: number
  previousPoints: number
  delta: number
  eventId?: string
}) {
  const initialDisplayPoints = eventId && delta !== 0 ? previousPoints : points
  const [displayPoints, setDisplayPoints] = useState(initialDisplayPoints)

  useEffect(() => {
    if (!eventId || delta === 0) {
      setDisplayPoints(points)
      return
    }

    setDisplayPoints(previousPoints)
    const direction = delta > 0 ? 1 : -1
    const steps = Math.abs(delta)
    let currentStep = 0
    const interval = window.setInterval(() => {
      currentStep += 1
      setDisplayPoints(previousPoints + currentStep * direction)
      if (currentStep >= steps) {
        window.clearInterval(interval)
      }
    }, 120)

    return () => window.clearInterval(interval)
  }, [delta, eventId, points, previousPoints])

  return (
    <div className="broadcast-player-points">
      {eventId && delta !== 0 && (
        <span className="point-delta">
          {delta > 0 ? '+' : ''}
          {delta}
        </span>
      )}
      <span className="point-count">{displayPoints}</span>
    </div>
  )
}

function MatchPitch({
  gameweek,
  scoreline,
  leaderName,
  latestEvent,
  scoreRef,
}: {
  gameweek: number
  scoreline: string
  leaderName: string
  latestEvent?: FantasyEventView
  scoreRef: RefObject<HTMLElement | null>
}) {
  const eventText = latestEvent
    ? `${latestEvent.type.replaceAll('_', ' ')} ${latestEvent.pointDelta > 0 ? '+' : ''}${latestEvent.pointDelta}`
    : 'KICKOFF'

  return (
    <section className="pitch-panel" aria-label="Fantasy pitch">
      <div className="match-score-strip">
        <span>GW{gameweek}</span>
        <strong ref={scoreRef}>{formatScoreline(scoreline)}</strong>
        <small>
          <Trophy size={14} />
          {leaderName === 'No one' ? 'Level' : leaderName}
        </small>
      </div>
      <div className="css-pitch">
        <span className="pitch-line halfway" />
        <span className="pitch-box left-box" />
        <span className="pitch-box right-box" />
        <span className="pitch-circle" />
        <span className="moving-dot dot-one" />
        <span className="moving-dot dot-two" />
        <span className="moving-dot dot-three" />
        <span className="moving-dot dot-four" />
        <span className="moving-dot dot-five" />
        <span className="moving-dot dot-six" />
        <span className="moving-dot dot-ball" />
      </div>
      <div className="pitch-event-ticker">{eventText}</div>
    </section>
  )
}

function MatchReveal({ layout, matchup }: { layout: RevealLayout | null; matchup: MatchupView }) {
  return (
    <div className="match-reveal-overlay" aria-hidden="true">
      <div className="match-reveal-sheet" />
      {layout && (
        <>
          <strong className="match-reveal-copy match-reveal-team reveal-home" style={revealCopyStyle(layout.home, 1.08)}>
            {matchup.home.clubName}
          </strong>
          <strong className="match-reveal-copy match-reveal-score" style={revealCopyStyle(layout.score, 1.08)}>
            {formatScoreline(matchup.scoreline)}
          </strong>
          <strong className="match-reveal-copy match-reveal-team reveal-away" style={revealCopyStyle(layout.away, 1.08)}>
            {matchup.away.clubName}
          </strong>
        </>
      )}
    </div>
  )
}
