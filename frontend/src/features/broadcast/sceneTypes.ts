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
