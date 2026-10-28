import type { FplClubShirt } from '../../shared/fpl/types'
import type { ScenePhase } from './broadcastPlayback'
import type { BroadcastFocus, LiveStandingView, LiveStateResponse, MatchupView } from './types'

export type BroadcastMatchdayProps = {
  layout?: 'desktop'
  leagueName?: string
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
  connectionError?: string | null
  onBack: () => void
  onSelectFocus: (focus: BroadcastFocus) => void
  onToggleStandings: () => void
}
export type BroadcastScenePresentation = {
  phase: ScenePhase
  transitionId: number
  revealIndex: number
  covered: (id: number) => void
  settled: (id: number) => void
  visibleEventId: string | null
  showingLiveLeaderboard: boolean
  holdingPendingUpdates: boolean
}
