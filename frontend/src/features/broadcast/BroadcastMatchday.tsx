import { useState } from 'react'
import { PlayerDetailsModal, type SelectedPlayer } from '../players/PlayerDetailsModal'
import { HeadToHeadScene } from './HeadToHeadScene'
import { TotalPointsBroadcast } from './TotalPointsScene'
import type { FplClubShirt } from '../../shared/fpl/types'
import type { RefObject } from 'react'
import type {
  BroadcastFocus,
  LiveStandingView,
  LiveStateResponse,
  MatchupView,
  RevealLayout,
  RevealRect,
} from './types'

export type BroadcastMatchdayProps = {
  leagueId?: number
  shirtCodesOverride?: FplClubShirt[]
  displayLiveState: LiveStateResponse
  matchup?: MatchupView
  latestCommentaryId?: string
  latestCommentaryText: string
  latestCommentaryStatus: string
  leaderName: string
  broadcastFocus: BroadcastFocus
  automaticFocus: BroadcastFocus
  standings: LiveStandingView[]
  presentation: BroadcastScenePresentation
  onBack: () => void
  onSelectFocus: (focus: BroadcastFocus) => void
}

export type BroadcastScenePresentation = {
  revealingMatch: boolean
  revealLayout: RevealLayout | null
  transitioningToMatch: boolean
  visibleEventId: string | null
  homeHeadingRef: RefObject<HTMLHeadingElement | null>
  awayHeadingRef: RefObject<HTMLHeadingElement | null>
  scoreRef: RefObject<HTMLElement | null>
  totalTeamNameRef: RefObject<HTMLSpanElement | null>
  totalHeadingRef: RefObject<HTMLHeadingElement | null>
  showingLiveLeaderboard: boolean
  leaderboardRevealLayout: RevealRect | null
  leaderboardHeadingRef: RefObject<HTMLHeadingElement | null>
  holdingPendingUpdates: boolean
}

export function BroadcastMatchday(props: BroadcastMatchdayProps) {
  const { leagueId, displayLiveState, matchup, presentation } = props
  const { visibleEventId, holdingPendingUpdates } = presentation
  const [selectedPlayer, setSelectedPlayer] = useState<SelectedPlayer | null>(null)
  const selectPlayer = (event: React.MouseEvent<HTMLElement>) => {
    const button =
      event.target instanceof Element ? event.target.closest<HTMLElement>('[data-player-id]') : null
    if (!button) return
    const id = button.dataset.playerId
    if (id)
      setSelectedPlayer({
        id,
        name: button.dataset.playerName ?? 'Player',
        shirtUrl: button.dataset.shirtUrl,
        points: Number(button.dataset.playerPoints ?? 0),
      })
  }
  const playerModal = selectedPlayer ? (
    <PlayerDetailsModal
      key={selectedPlayer.id}
      player={selectedPlayer}
      leagueId={leagueId}
      gameweek={displayLiveState.gameweek}
      onClose={() => setSelectedPlayer(null)}
    />
  ) : null
  const displayLatestEvent = displayLiveState.events?.[0]
  const displayEvents = visibleEventId === displayLatestEvent?.id ? displayLiveState.events : []
  if (!matchup && (displayLiveState.teams?.length ?? 0) > 0) {
    return (
      <TotalPointsBroadcast
        {...props}
        latestEvent={displayLatestEvent}
        latestEvents={displayEvents}
        pendingEvents={holdingPendingUpdates ? (displayLiveState.events ?? []) : []}
        onPlayerClick={selectPlayer}
        playerModal={playerModal}
      />
    )
  }
  if (!matchup) return null
  return (
    <HeadToHeadScene
      {...props}
      matchup={matchup}
      selectPlayer={selectPlayer}
      playerModal={playerModal}
      displayLatestEvent={displayLatestEvent}
      displayEvents={displayEvents}
    />
  )
}
