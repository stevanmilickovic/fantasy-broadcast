import type { ReactNode } from 'react'
import { BroadcastFrame } from './BroadcastFrame'
import { BroadcastSquad } from './BroadcastSquad'
import { BroadcastTeamIdentity, BroadcastTeamScore } from './HeadToHeadScene'
import { LiveStandings } from './BroadcastStandings'
import type { BroadcastMatchdayProps } from './sceneTypes'
import type { FantasyEventView } from './types'

export function TotalPointsBroadcast(
  props: BroadcastMatchdayProps & {
    latestEvent?: FantasyEventView
    latestEvents: FantasyEventView[]
    pendingEvents: FantasyEventView[]
    onPlayerClick: (event: React.MouseEvent<HTMLElement>) => void
    playerModal: ReactNode
  },
) {
  const { displayLiveState: state, presentation, latestEvents: events } = props
  const team =
    state.teams.find((candidate) => candidate.managerId === props.automaticFocus) ?? state.teams[0]
  if (!team) return null
  const standings = presentation.showingLiveLeaderboard
  return (
    <>
      <BroadcastFrame props={props} events={events} kind={standings ? 'standings' : 'points'}>
        {standings ? (
          <LiveStandings standings={props.standings} scoring="points" reveal />
        ) : (
          <section
            className="broadcast-content"
            aria-label="Focused total-points club broadcast"
            onClick={props.onPlayerClick}
          >
            <header className="broadcast-scoreboard broadcast-points-scoreboard">
              <BroadcastTeamIdentity team={team} role="home" />
              <div className="broadcast-score-cell" data-reveal-cell>
                <span>Gameweek {state.gameweek} points</span>
                <strong className="broadcast-score" data-reveal-role="score">
                  <BroadcastTeamScore
                    team={team}
                    events={events}
                    pendingEvents={props.pendingEvents}
                  />
                  <small>pts</small>
                </strong>
              </div>
            </header>
            <div className="broadcast-points-body">
              <BroadcastSquad
                team={team}
                side="home"
                events={events}
                pendingEvents={props.pendingEvents}
                shirtCodesOverride={props.shirtCodesOverride}
              />
              <div className="broadcast-standings-sidebar">
                <LiveStandings
                  standings={props.standings}
                  scoring="points"
                  focusedId={team.managerId}
                />
              </div>
            </div>
          </section>
        )}
      </BroadcastFrame>
      {props.playerModal}
    </>
  )
}
