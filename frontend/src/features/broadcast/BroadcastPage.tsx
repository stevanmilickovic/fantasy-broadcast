import { useQuery } from '../../shared/api/useQuery'
import { TeamEmblemProvider } from '../leagues/TeamEmblemProvider'
import { useTeamEmblems } from '../leagues/teamEmblems'
import { loadRegisteredLeagues } from '../leagues/api'
import { Radio } from 'lucide-react'
import { useState } from 'react'
import type { Navigate } from '../../app/useBrowserNavigation'
import type { AuthUser } from '../auth/types'
import { BroadcastMatchday } from './BroadcastMatchday'
import { useBroadcastEventQueue } from './useBroadcastEventQueue'
import { useBroadcastFocus } from './useBroadcastFocus'
import { useBroadcastPresentation } from './useBroadcastPresentation'
import { useBroadcastAudio } from './useBroadcastAudio'
import { useLiveState } from './useLiveState'
import { useScreenWakeLock } from './useScreenWakeLock'
import { BroadcastChat } from '../chat/BroadcastChat'
import type { BroadcastFocus } from './types'

type Props = {
  user: AuthUser
  leagueId?: number
  navigate: Navigate
}

export function BroadcastPage(props: Props) {
  return (
    <TeamEmblemProvider leagueId={props.leagueId}>
      <LeagueBroadcast {...props} />
    </TeamEmblemProvider>
  )
}

function LeagueBroadcast({ user, leagueId, navigate }: Props) {
  const emblems = useTeamEmblems()
  const leagues = useQuery(`broadcast-leagues:${user.id}`, loadRegisteredLeagues)
  const leagueName = leagues.data?.find((league) => league.id === leagueId)?.displayName
  const [broadcastFocus, setBroadcastFocus] = useState<BroadcastFocus>('multi')
  const [manualStandings, setManualStandings] = useState(false)
  const [selectionRevision, setSelectionRevision] = useState(0)
  const [defer, setDefer] = useState(false)
  useScreenWakeLock(true)
  const { liveState, error, retry } = useLiveState({ enabled: true, leagueId })
  const queue = useBroadcastEventQueue(liveState, defer)
  const focus = useBroadcastFocus({
    liveState,
    latestEvent: queue.latestEvent,
    selectedFocus: broadcastFocus,
  })
  const presentation = useBroadcastPresentation({
    liveState,
    activeLiveState: queue.activeLiveState,
    activeEvents: queue.activeEvents,
    hasPendingNotifications: queue.hasPendingNotifications,
    focusedId: focus.focusedId,
    selectedFocus: broadcastFocus,
    latestEventId: queue.latestEvent?.id,
    showingLeaderboard: manualStandings || focus.showingLeaderboard,
    onTransitionStateChange: setDefer,
    selectionRevision,
  })
  useBroadcastAudio(
    presentation.liveState,
    presentation.visibleEventId,
    presentation.displayingLeaderboard ? null : presentation.displayedFocusId,
  )
  if (
    emblems.loading ||
    !liveState ||
    (!liveState.matchups.length && !liveState.teams.length) ||
    !presentation.liveState
  )
    return (
      <main className="broadcast-view loading-shell">
        <div>
          <Radio size={28} />
          <h1>Fantasy Broadcast</h1>
          <p>
            {error ??
              (liveState && !liveState.matchups.length && !liveState.teams.length
                ? 'No teams are available for this broadcast yet.'
                : 'Connecting to the broadcast…')}
          </p>
          {error && (
            <button type="button" onClick={retry}>
              Try again
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate(user.role === 'ADMIN' ? '/administration' : '/leagues')}
          >
            Back
          </button>
        </div>
      </main>
    )
  const state = presentation.liveState
  const matchup =
    state.matchups.find((match) => match.id === presentation.displayedFocusId) ?? state.matchups[0]
  const commentary = state.commentary[0]
  return (
    <>
      <BroadcastMatchday
        leagueId={leagueId}
        leagueName={leagueName}
        displayLiveState={state}
        matchup={matchup}
        latestCommentaryId={commentary?.id}
        latestCommentaryText={commentary?.text ?? ''}
        latestCommentaryStatus={commentary?.status ?? 'WAITING'}
        leaderName={
          matchup
            ? matchup.leaderManagerId === matchup.home.managerId
              ? matchup.home.displayName
              : matchup.leaderManagerId === matchup.away.managerId
                ? matchup.away.displayName
                : 'No one'
            : 'No one'
        }
        broadcastFocus={broadcastFocus}
        automaticFocus={presentation.displayedFocusId ?? 'multi'}
        standings={presentation.standings}
        presentation={{
          ...presentation,
          showingLiveLeaderboard: presentation.displayingLeaderboard,
        }}
        connectionError={error}
        onBack={() => navigate(user.role === 'ADMIN' ? '/administration' : '/leagues')}
        onSelectFocus={(selection) => {
          focus.dismissLeaderboard()
          setManualStandings(false)
          setBroadcastFocus(selection)
          setSelectionRevision((value) => value + 1)
        }}
        onToggleStandings={() => {
          focus.dismissLeaderboard()
          setManualStandings(!presentation.displayingLeaderboard)
          setSelectionRevision((value) => value + 1)
        }}
      />
      {leagueId && <BroadcastChat key={leagueId} leagueId={leagueId} />}
    </>
  )
}
