import { useCallback, useEffect, useMemo, useState } from 'react'
import { BroadcastMatchday } from '../broadcast/BroadcastMatchday'
import type { LiveStandingView } from '../broadcast/types'
import { useBroadcastPresentation } from '../broadcast/useBroadcastPresentation'
import { TeamEmblemsContext } from '../leagues/teamEmblems'
import {
  welcomeBroadcastState,
  welcomeDemoFrames,
  welcomeShirtCodes,
  welcomeTeamEmblems,
} from './welcomeDemoData'

const demoEmblems = { teams: welcomeTeamEmblems, loading: false, refresh: () => {} }

export function WelcomeBroadcastDemo({
  replay,
}: {
  replay?: {
    gameweek: number
    standings: Omit<LiveStandingView, 'gameweekPoints'>[]
    onBack: () => void
  }
} = {}) {
  const [frame, setFrame] = useState(0)
  const [selection, setSelection] = useState('multi')
  const [standings, setStandings] = useState(false)
  const [revision, setRevision] = useState(0)
  const state = useMemo(() => {
    const snapshot = welcomeBroadcastState(frame)
    if (!replay) return snapshot
    return {
      ...snapshot,
      gameweek: replay.gameweek,
      status: { ...snapshot.status, message: 'Scripted replay' },
      standings: replay.standings.map((standing) => ({
        ...standing,
        gameweekPoints:
          snapshot.standings.find((row) => row.teamId === standing.teamId)?.gameweekPoints ?? 0,
      })),
    }
  }, [frame, replay])
  const onTransition = useCallback(() => {}, [])
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) setFrame((value) => (value + 1) % welcomeDemoFrames.length)
    }, 12000)
    return () => window.clearInterval(timer)
  }, [])
  const target =
    selection === 'multi'
      ? state.matchups[welcomeDemoFrames[frame].matchupIndex]
      : (state.matchups.find((match) => match.id === selection) ?? state.matchups[0])
  const presentation = useBroadcastPresentation({
    liveState: state,
    activeLiveState: state,
    hasPendingNotifications: false,
    focusedId: target.id,
    selectedFocus: selection,
    latestEventId: state.events[0]?.id,
    showingLeaderboard: standings,
    onTransitionStateChange: onTransition,
    selectionRevision: revision,
  })
  const displayed = presentation.liveState
  if (!displayed) return <div className="welcome-real-broadcast" />
  const matchup =
    displayed.matchups.find((match) => match.id === presentation.displayedFocusId) ??
    displayed.matchups[0]
  const commentary = displayed.commentary[0]
  const broadcast = (
    <BroadcastMatchday
      layout={replay ? undefined : 'desktop'}
      leagueName="Sunday League Elite"
      shirtCodesOverride={welcomeShirtCodes}
      displayLiveState={displayed}
      matchup={matchup}
      latestCommentaryId={commentary?.id}
      latestCommentaryText={commentary?.text ?? ''}
      latestCommentaryStatus={commentary?.status ?? 'WAITING'}
      leaderName={
        matchup.leaderManagerId === matchup.home.managerId
          ? matchup.home.displayName
          : matchup.leaderManagerId === matchup.away.managerId
            ? matchup.away.displayName
            : 'No one'
      }
      broadcastFocus={selection}
      automaticFocus={presentation.displayedFocusId ?? 'multi'}
      presentation={{
        ...presentation,
        showingLiveLeaderboard: presentation.displayingLeaderboard,
      }}
      standings={displayed.standings}
      onBack={replay?.onBack ?? (() => {})}
      onSelectFocus={(value) => {
        setSelection(value)
        setStandings(false)
        setRevision((current) => current + 1)
      }}
      onToggleStandings={() => {
        setStandings((value) => !value)
        setRevision((current) => current + 1)
      }}
    />
  )
  return (
    <TeamEmblemsContext value={demoEmblems}>
      {replay ? (
        broadcast
      ) : (
        <div
          className="welcome-real-broadcast"
          data-nosnippet=""
          data-broadcast-tilt
          aria-label="Interactive example of the live broadcast"
        >
          <div className="welcome-broadcast-scale">{broadcast}</div>
        </div>
      )}
    </TeamEmblemsContext>
  )
}
