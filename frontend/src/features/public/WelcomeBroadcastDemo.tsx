import { useCallback, useEffect, useMemo, useState } from 'react'
import { BroadcastMatchday } from '../broadcast/BroadcastMatchday'
import { useBroadcastPresentation } from '../broadcast/useBroadcastPresentation'
import { welcomeBroadcastState, welcomeDemoFrames, welcomeShirtCodes } from './welcomeDemoData'

export function WelcomeBroadcastDemo() {
  const [frame, setFrame] = useState(0)
  const [selection, setSelection] = useState('multi')
  const [standings, setStandings] = useState(false)
  const [revision, setRevision] = useState(0)
  const state = useMemo(() => welcomeBroadcastState(frame), [frame])
  const onTransition = useCallback(() => {}, [])
  useEffect(() => {
    const timer = window.setInterval(
      () => setFrame((value) => (value + 1) % welcomeDemoFrames.length),
      12000,
    )
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
  return (
    <div
      className="welcome-real-broadcast"
      data-broadcast-tilt
      aria-label="Interactive example of the live broadcast"
    >
      <div className="welcome-broadcast-scale">
        <BroadcastMatchday
          layout="desktop"
          leagueName="Sunday League Elite"
          shirtCodesOverride={welcomeShirtCodes}
          displayLiveState={displayed}
          matchup={matchup}
          latestCommentaryId={commentary?.id}
          latestCommentaryText={commentary?.text ?? ''}
          latestCommentaryStatus={commentary?.status ?? 'WAITING'}
          leaderName={matchup.home.displayName}
          broadcastFocus={selection}
          automaticFocus={presentation.displayedFocusId ?? 'multi'}
          presentation={{
            ...presentation,
            showingLiveLeaderboard: presentation.displayingLeaderboard,
          }}
          standings={displayed.standings}
          onBack={() => {}}
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
      </div>
    </div>
  )
}
