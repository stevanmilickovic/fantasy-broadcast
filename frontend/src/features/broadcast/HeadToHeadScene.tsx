import { ArrowLeft, Radio } from 'lucide-react'
import { useLayoutEffect, type CSSProperties, type RefObject, type ReactNode } from 'react'
import { teamShortName } from './broadcast'
import { LeaderboardReveal, MatchReveal } from './BroadcastReveals'
import { NarrationCaption } from './BroadcastChrome'
import { MatchSelector } from './BroadcastSelectors'
import { HeadToHeadLeaderboard } from './BroadcastStandings'
import { PitchStage } from './BroadcastPitch'
import type { BroadcastMatchdayProps } from './BroadcastMatchday'
import type { FantasyEventView, MatchupView, TeamView } from './types'

export function HeadToHeadScene({
  presentation,
  displayLiveState,
  matchup,
  latestCommentaryId,
  latestCommentaryText,
  latestCommentaryStatus,
  leaderName,
  broadcastFocus,
  shirtCodesOverride,
  standings,
  onBack,
  onSelectFocus,
  selectPlayer,
  playerModal,
  displayLatestEvent,
  displayEvents,
}: BroadcastMatchdayProps & {
  matchup: MatchupView
  selectPlayer: (event: React.MouseEvent<HTMLElement>) => void
  playerModal: ReactNode
  displayLatestEvent?: FantasyEventView
  displayEvents: FantasyEventView[]
}) {
  const {
    revealingMatch,
    revealLayout,
    transitioningToMatch,
    homeHeadingRef,
    awayHeadingRef,
    scoreRef,
    showingLiveLeaderboard,
    leaderboardRevealLayout,
    leaderboardHeadingRef,
    holdingPendingUpdates,
  } = presentation
  return (
    <main
      className={`broadcast-shell matchday-page ${revealingMatch ? 'revealing-match' : ''}`}
      onClick={selectPlayer}
    >
      {transitioningToMatch && <div className="scene-wipe-overlay" aria-hidden="true" />}
      {revealingMatch &&
        (showingLiveLeaderboard ? (
          <LeaderboardReveal layout={leaderboardRevealLayout} headingRef={leaderboardHeadingRef} />
        ) : (
          <MatchReveal
            layout={revealLayout}
            matchup={matchup}
            homeHeadingRef={homeHeadingRef}
            awayHeadingRef={awayHeadingRef}
            scoreRef={scoreRef}
          />
        ))}
      <button className="floating-back" type="button" onClick={onBack}>
        <ArrowLeft size={18} />
        Back
      </button>
      <div className="live-indicator">
        <Radio size={16} />
        <span>Live</span>
      </div>
      <NarrationCaption
        id={latestCommentaryId}
        text={latestCommentaryText}
        status={latestCommentaryStatus}
      />
      <MatchSelector
        latestEvent={displayLatestEvent}
        matchups={displayLiveState.matchups}
        selectedFocus={broadcastFocus}
        onSelect={onSelectFocus}
      />

      {showingLiveLeaderboard ? (
        <HeadToHeadLeaderboard standings={standings} headingRef={leaderboardHeadingRef} />
      ) : (
        <section
          className="matchday-stage pitch-broadcast-stage"
          aria-label="Focused matchup broadcast"
        >
          <BroadcastTeamColumn
            side="left"
            team={matchup.home}
            isLeader={matchup.leaderManagerId === matchup.home.managerId}
            headingRef={homeHeadingRef}
          />
          <PitchStage
            shirtCodesOverride={shirtCodesOverride}
            gameweek={displayLiveState.gameweek}
            scoreline={matchup.scoreline}
            leaderName={leaderName}
            scoreRef={scoreRef}
            matchup={matchup}
            latestEvents={displayEvents}
            pendingEvents={holdingPendingUpdates ? (displayLiveState.events ?? []) : []}
          />
          <BroadcastTeamColumn
            side="right"
            team={matchup.away}
            isLeader={matchup.leaderManagerId === matchup.away.managerId}
            headingRef={awayHeadingRef}
          />
        </section>
      )}
      {playerModal}
    </main>
  )
}

function BroadcastTeamColumn({
  side,
  team,
  isLeader,
  headingRef,
}: {
  side: 'left' | 'right'
  team: TeamView
  isLeader: boolean
  headingRef: RefObject<HTMLHeadingElement | null>
}) {
  useLayoutEffect(() => {
    const heading = headingRef.current
    const container = heading?.parentElement
    if (!heading || !container) return
    const fitName = () => {
      heading.style.fontSize = ''
      const computedStyle = window.getComputedStyle(heading)
      const naturalSize = Number.parseFloat(computedStyle.fontSize)
      const availableWidth = container.clientWidth
      const context = document.createElement('canvas').getContext('2d')
      if (!context || !availableWidth) return
      context.font = `${computedStyle.fontWeight} ${naturalSize}px ${computedStyle.fontFamily}`
      const textWidth = context.measureText(team.clubName).width
      const safeWidth = Math.max(1, availableWidth - 10)
      if (textWidth <= safeWidth) return
      heading.style.fontSize = `${Math.max(8, Math.floor((naturalSize * safeWidth) / textWidth))}px`
    }
    const resizeObserver = new ResizeObserver(fitName)
    resizeObserver.observe(container)
    fitName()
    const layoutFrame = window.requestAnimationFrame(fitName)
    return () => {
      resizeObserver.disconnect()
      window.cancelAnimationFrame(layoutFrame)
    }
  }, [headingRef, team.clubName])

  return (
    <section
      className={`broadcast-team-column ${side}`}
      style={{ '--team-color': team.color } as CSSProperties}
    >
      <div className="broadcast-team-heading">
        <span>{teamShortName(team)}</span>
        <h2 ref={headingRef}>{team.clubName}</h2>
        <p>{team.displayName}</p>
        <strong className={isLeader ? '' : 'leader-placeholder'}>Leading</strong>
      </div>
    </section>
  )
}
