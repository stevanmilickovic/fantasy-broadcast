import { Radio } from 'lucide-react'
import { useState } from 'react'
import type { Navigate } from '../../app/useBrowserNavigation'
import type { AuthUser } from '../auth/types'
import { findFocusedMatchup } from './broadcast'
import { BroadcastMatchday } from './BroadcastMatchday'
import type { BroadcastFocus } from './types'
import { useBroadcastEventQueue } from './useBroadcastEventQueue'
import { useBroadcastFocus } from './useBroadcastFocus'
import { useBroadcastPresentation } from './useBroadcastPresentation'
import { useLiveState } from './useLiveState'
import { useScreenWakeLock } from './useScreenWakeLock'

export function BroadcastPage({
  user: authUser,
  leagueId,
  navigate,
}: {
  user: AuthUser
  leagueId?: number
  navigate: Navigate
}) {
  const [broadcastFocus, setBroadcastFocus] = useState<BroadcastFocus>('multi')
  const [deferQueuedNotificationStart, setDeferQueuedNotificationStart] = useState(false)
  useScreenWakeLock(true)
  const { liveState, error } = useLiveState({ enabled: true, leagueId })
  const {
    activeEvents: activeBroadcastEvents,
    activeLiveState,
    hasPendingNotifications,
    latestEvent: targetLatestEvent,
  } = useBroadcastEventQueue(liveState, deferQueuedNotificationStart)
  const {
    targetMatchup,
    focusedId: focusedMatchupId,
    isTotalPointsBroadcast,
    showingLeaderboard: showingLiveLeaderboard,
    dismissLeaderboard: dismissLiveLeaderboard,
  } = useBroadcastFocus({
    liveState,
    latestEvent: targetLatestEvent,
    selectedFocus: broadcastFocus,
  })
  const {
    liveState: broadcastLiveState,
    standings: broadcastStandings,
    displayedFocusId,
    transitioningToMatch,
    revealingMatch,
    revealLayout,
    visibleEventId,
    holdingPendingUpdates,
    displayingLeaderboard: displayingLiveLeaderboard,
    leaderboardRevealLayout,
    homeHeadingRef,
    awayHeadingRef,
    scoreRef,
    totalTeamNameRef,
    totalHeadingRef,
    leaderboardHeadingRef,
    hideDisplayedLeaderboard,
  } = useBroadcastPresentation({
    liveState,
    activeLiveState,
    hasPendingNotifications,
    focusedId: focusedMatchupId,
    selectedFocus: broadcastFocus,
    latestEventId: targetLatestEvent?.id,
    showingLeaderboard: showingLiveLeaderboard,
    isTotalPointsBroadcast,
    onTransitionStateChange: setDeferQueuedNotificationStart,
  })

  if (!liveState || (!targetMatchup && !isTotalPointsBroadcast)) {
    return (
      <main className="broadcast-shell loading-shell">
        <div>
          <Radio size={28} />
          <h1>Fantasy Broadcast</h1>
          <p>{error ? error : 'Loading live broadcast state...'}</p>
        </div>
      </main>
    )
  }

  const displayLiveState = { ...(broadcastLiveState ?? liveState), events: activeBroadcastEvents }
  const displayStandings = broadcastStandings ?? displayLiveState.standings ?? []
  const autoDisplayMatchup = findFocusedMatchup(displayLiveState)
  const displayedMatchup = displayedFocusId
    ? displayLiveState.matchups?.find((candidate) => candidate.id === displayedFocusId)
    : undefined
  const selectedDisplayMatchup =
    broadcastFocus === 'multi'
      ? undefined
      : displayLiveState.matchups?.find((candidate) => candidate.id === broadcastFocus)
  const matchup =
    selectedDisplayMatchup ??
    displayedMatchup ??
    (displayLiveState.events?.length ? autoDisplayMatchup : (targetMatchup ?? autoDisplayMatchup))
  const latestCommentary = displayLiveState.commentary?.[0]
  const leaderName =
    matchup && matchup.leaderManagerId === matchup.home.managerId
      ? matchup.home.displayName
      : matchup && matchup.leaderManagerId === matchup.away.managerId
        ? matchup.away.displayName
        : 'No one'

  return (
    <BroadcastMatchday
      displayLiveState={displayLiveState}
      matchup={matchup}
      latestCommentaryId={latestCommentary?.id}
      latestCommentaryText={latestCommentary?.text ?? 'Waiting for commentary.'}
      latestCommentaryStatus={latestCommentary?.status ?? 'WAITING'}
      leaderName={leaderName}
      broadcastFocus={broadcastFocus}
      automaticFocus={displayedFocusId ?? focusedMatchupId ?? 'multi'}
      presentation={{
        revealingMatch,
        revealLayout,
        transitioningToMatch,
        visibleEventId,
        homeHeadingRef,
        awayHeadingRef,
        scoreRef,
        totalTeamNameRef,
        totalHeadingRef,
        showingLiveLeaderboard: displayingLiveLeaderboard,
        leaderboardRevealLayout,
        leaderboardHeadingRef,
        holdingPendingUpdates,
      }}
      standings={displayStandings}
      onBack={() => {
        navigate(authUser.role === 'ADMIN' ? '/administration' : '/leagues')
      }}
      onSelectFocus={(focus) => {
        dismissLiveLeaderboard()
        hideDisplayedLeaderboard()
        setBroadcastFocus(focus)
      }}
    />
  )
}
