import { ArrowLeft, Radio, Trophy } from 'lucide-react'
import type { ReactNode } from 'react'
import { BroadcastSelectors } from './BroadcastSelectors'
import { BroadcastEventRail } from './BroadcastEventRail'
import { useSceneTransition } from './useSceneTransition'
import type { BroadcastMatchdayProps } from './sceneTypes'
import type { FantasyEventView } from './types'

export function BroadcastFrame({
  props,
  events,
  kind,
  children,
}: {
  props: BroadcastMatchdayProps
  events: FantasyEventView[]
  kind: 'h2h' | 'points' | 'standings'
  children: ReactNode
}) {
  const { displayLiveState: state, presentation, connectionError } = props
  const root = useSceneTransition(presentation)
  const demo = /mock|demo/i.test(state.status.mode)
  const activeManagers =
    kind === 'h2h' && props.matchup
      ? [props.matchup.home.managerId, props.matchup.away.managerId]
      : kind === 'points'
        ? [props.automaticFocus]
        : []
  const visibleEvents = events.filter((event) => activeManagers.includes(event.managerId))
  return (
    <main
      ref={root}
      data-layout={props.layout}
      data-phase={presentation.phase}
      data-transition-id={presentation.transitionId}
      className={`broadcast-view matchday-page ${presentation.phase !== 'idle' ? 'revealing-match' : ''}`}
    >
      <header className="broadcast-controls">
        <button type="button" className="broadcast-back" aria-label="Back" onClick={props.onBack}>
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
        <BroadcastSelectors
          matchups={state.matchups}
          pendingEvents={presentation.holdingPendingUpdates ? state.events : []}
          teams={state.teams}
          selectedFocus={props.broadcastFocus}
          automaticFocus={props.automaticFocus}
          onSelect={props.onSelectFocus}
        />
        <button
          type="button"
          className="broadcast-standings-button"
          aria-label="Standings"
          aria-pressed={presentation.showingLiveLeaderboard}
          onClick={props.onToggleStandings}
        >
          <Trophy size={16} />
          <span>Standings</span>
        </button>
        <span
          className={`broadcast-connection ${connectionError ? 'interrupted' : ''}`}
          role="status"
          title={connectionError ?? state.status.message}
        >
          <Radio size={12} />
          {connectionError ? 'Reconnecting' : demo ? 'Demo' : 'Connected'}
        </span>
      </header>
      {connectionError && (
        <p className="broadcast-connection-detail" role="status">
          {connectionError} Showing the last received update.
        </p>
      )}
      <div
        className={`broadcast-scene broadcast-scene-${kind}`}
        data-phase={presentation.phase}
        data-transition-id={presentation.transitionId}
      >
        {children}
        <div className="broadcast-intro-layout" aria-hidden="true">
          {(kind === 'standings'
            ? ['heading']
            : kind === 'points'
              ? ['home', 'score']
              : ['home', 'score', 'away']
          ).map((role) => (
            <span key={role} data-intro-slot={role} />
          ))}
        </div>
      </div>
      <div className="broadcast-intro-backdrop" aria-hidden="true" />
      <div className="broadcast-wipe" aria-hidden="true">
        <i />
        <i />
        <i />
        <span className="broadcast-wipe-title">
          {presentation.revealIndex % 2 === 0 && props.leagueName
            ? props.leagueName
            : 'Fantasy Broadcast'}
        </span>
      </div>
      <BroadcastEventRail
        events={visibleEvents}
        teams={
          state.teams.length
            ? state.teams
            : state.matchups.flatMap((match) => [match.home, match.away])
        }
        text={props.latestCommentaryText}
        status={props.latestCommentaryStatus}
      />
    </main>
  )
}
