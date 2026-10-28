import { ArrowLeft, Radio } from 'lucide-react'
import { useLayoutEffect, type CSSProperties } from 'react'
import { teamShortName } from './broadcast'
import { LeaderboardReveal, TotalPointsReveal } from './BroadcastReveals'
import { NarrationCaption } from './BroadcastChrome'
import { ClubSelector } from './BroadcastSelectors'
import { LiveStandings, TotalPointsLeaderboard } from './BroadcastStandings'
import { TotalPointsPlayerRows } from './BroadcastPitch'
import { useShirtCodes } from '../../shared/fpl/useShirtCodes'
import type { BroadcastMatchdayProps } from './BroadcastMatchday'
import type { FantasyEventView } from './types'

export function TotalPointsBroadcast({
  presentation,
  shirtCodesOverride,
  displayLiveState,
  broadcastFocus,
  automaticFocus,
  latestEvent,
  latestEvents,
  pendingEvents,
  latestCommentaryId,
  latestCommentaryText,
  latestCommentaryStatus,
  standings,
  onBack,
  onSelectFocus,
  onPlayerClick,
  playerModal,
}: BroadcastMatchdayProps & {
  latestEvent?: FantasyEventView
  latestEvents: FantasyEventView[]
  pendingEvents: FantasyEventView[]
  onPlayerClick: (event: React.MouseEvent<HTMLElement>) => void
  playerModal: React.ReactNode
}) {
  const {
    revealingMatch,
    revealLayout,
    transitioningToMatch,
    showingLiveLeaderboard,
    leaderboardRevealLayout,
    leaderboardHeadingRef,
    totalTeamNameRef,
    totalHeadingRef,
    scoreRef,
  } = presentation
  const automaticallyFocusedTeam =
    automaticFocus !== 'multi'
      ? displayLiveState.teams?.find((candidate) => candidate.managerId === automaticFocus)
      : latestEvent
        ? displayLiveState.teams?.find((candidate) => candidate.managerId === latestEvent.managerId)
        : undefined
  const selectedTeam =
    broadcastFocus === 'multi'
      ? undefined
      : displayLiveState.teams?.find((candidate) => candidate.managerId === broadcastFocus)
  const team = selectedTeam ?? automaticallyFocusedTeam ?? displayLiveState.teams?.[0]
  const clubName = team?.clubName ?? ''
  const shirtCodes = useShirtCodes(shirtCodesOverride)
  useLayoutEffect(() => {
    const heading = totalHeadingRef.current
    const teamName = totalTeamNameRef.current
    const score = scoreRef.current
    if (!heading || !teamName || !score) return
    const compactQuery = window.matchMedia('(max-width: 900px)')

    const fitName = () => {
      teamName.style.fontSize = ''
      if (!compactQuery.matches) return
      const style = window.getComputedStyle(teamName)
      const naturalSize = Number.parseFloat(style.fontSize)
      const scoreStyle = window.getComputedStyle(score)
      const scoreMargin = Number.parseFloat(scoreStyle.marginLeft) || 0
      const availableWidth = heading.clientWidth - score.offsetWidth - scoreMargin
      const context = document.createElement('canvas').getContext('2d')
      if (!context || !availableWidth) return
      context.font = `${style.fontWeight} ${naturalSize}px ${style.fontFamily}`
      const textWidth = context.measureText(clubName).width
      if (textWidth > availableWidth)
        teamName.style.fontSize = `${Math.max(16, (naturalSize * availableWidth) / textWidth)}px`
    }

    const observer = new ResizeObserver(fitName)
    observer.observe(heading)
    observer.observe(score)
    compactQuery.addEventListener('change', fitName)
    fitName()
    return () => {
      observer.disconnect()
      compactQuery.removeEventListener('change', fitName)
    }
  }, [scoreRef, clubName, totalHeadingRef, totalTeamNameRef])
  if (!team) return null
  return (
    <main
      className={`broadcast-shell matchday-page total-points-broadcast ${revealingMatch ? 'revealing-match' : ''}`}
      onClick={onPlayerClick}
    >
      {transitioningToMatch && <div className="scene-wipe-overlay" aria-hidden="true" />}
      {revealingMatch &&
        (showingLiveLeaderboard ? (
          <LeaderboardReveal
            layout={leaderboardRevealLayout}
            headingRef={leaderboardHeadingRef}
            label="Live standings"
          />
        ) : (
          <TotalPointsReveal
            layout={revealLayout}
            team={team}
            teamNameRef={totalTeamNameRef}
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
      <ClubSelector
        teams={displayLiveState.teams}
        latestEvent={latestEvent}
        selectedFocus={broadcastFocus}
        onSelect={onSelectFocus}
      />
      {showingLiveLeaderboard ? (
        <TotalPointsLeaderboard standings={standings} headingRef={leaderboardHeadingRef} />
      ) : (
        <section
          className="matchday-stage total-points-stage"
          aria-label="Focused total-points club broadcast"
        >
          <section
            className="broadcast-team-column left total-points-team-column"
            style={{ '--team-color': team.color } as CSSProperties}
          >
            <div className="broadcast-team-heading">
              <span>{teamShortName(team)}</span>
              <h2 ref={totalHeadingRef}>
                <span ref={totalTeamNameRef} className="total-team-name">
                  {team.clubName}
                </span>
                <strong ref={scoreRef} className="total-team-score">
                  {team.score}
                  <span className="total-score-unit">pts</span>
                </strong>
              </h2>
              <p>{team.displayName}</p>
              <strong className="leader-placeholder">Leading</strong>
            </div>
            <TotalPointsPlayerRows
              team={team}
              shirtCodes={shirtCodes}
              latestEvents={latestEvents}
              pendingEvents={pendingEvents}
            />
          </section>
          <LiveStandings standings={standings} focusedTeam={team} />
        </section>
      )}
      {playerModal}
    </main>
  )
}
