import type { ReactNode } from 'react'
import { TeamEmblem } from '../leagues/TeamEmblem'
import { formatScoreline } from './broadcast'
import { BroadcastFrame } from './BroadcastFrame'
import { BroadcastSquad } from './BroadcastSquad'
import { LiveStandings } from './BroadcastStandings'
import { usePlayerNotification } from './usePlayerNotification'
import type { BroadcastMatchdayProps } from './sceneTypes'
import type { FantasyEventView, MatchupView, TeamView } from './types'

export function BroadcastTeamIdentity({
  team,
  role,
  leading,
}: {
  team: TeamView
  role: 'home' | 'away'
  leading?: boolean
}) {
  return (
    <div className={`broadcast-identity ${role}`} data-reveal-cell>
      <TeamEmblem managerId={team.managerId} revealRole={`${role}-emblem`} />
      <h2 data-reveal-role={role}>
        <span>{team.clubName}</span>
      </h2>
      <p>{team.displayName}</p>
      <small className="broadcast-leading">{leading ? 'Leading' : '\u00a0'}</small>
    </div>
  )
}
export function BroadcastTeamScore({
  team,
  events,
  pendingEvents,
}: {
  team: TeamView
  events: FantasyEventView[]
  pendingEvents: FantasyEventView[]
}) {
  const active = events.filter((event) => event.managerId === team.managerId)
  const pending = pendingEvents
    .filter((event) => event.managerId === team.managerId)
    .reduce((sum, event) => sum + event.pointDelta, 0)
  const { pointsToRender } = usePlayerNotification(team.score, active, pending)
  return <>{pointsToRender}</>
}
export function HeadToHeadScene(
  props: BroadcastMatchdayProps & {
    matchup: MatchupView
    selectPlayer: (event: React.MouseEvent<HTMLElement>) => void
    playerModal: ReactNode
    displayLatestEvent?: FantasyEventView
    displayEvents: FantasyEventView[]
  },
) {
  const { matchup, presentation, displayLiveState: state, displayEvents: events } = props
  const pending = presentation.holdingPendingUpdates ? state.events : []
  const standings = presentation.showingLiveLeaderboard
  return (
    <>
      <BroadcastFrame props={props} events={events} kind={standings ? 'standings' : 'h2h'}>
        {standings ? (
          <LiveStandings standings={props.standings} scoring="h2h" reveal />
        ) : (
          <section
            className="broadcast-content"
            aria-label="Focused matchup broadcast"
            onClick={props.selectPlayer}
          >
            <header className="broadcast-scoreboard">
              <BroadcastTeamIdentity
                team={matchup.home}
                role="home"
                leading={matchup.leaderManagerId === matchup.home.managerId}
              />
              <div className="broadcast-score-cell" data-reveal-cell>
                <span>Gameweek {state.gameweek}</span>
                <strong
                  data-reveal-role="score"
                  className="broadcast-score"
                  aria-label={`Score ${formatScoreline(matchup.scoreline)}`}
                >
                  <BroadcastTeamScore team={matchup.home} events={events} pendingEvents={pending} />
                  <span className="broadcast-score-separator">
                    {matchup.home.score < 0 || matchup.away.score < 0 ? 'to' : '–'}
                  </span>
                  <BroadcastTeamScore team={matchup.away} events={events} pendingEvents={pending} />
                </strong>
              </div>
              <BroadcastTeamIdentity
                team={matchup.away}
                role="away"
                leading={matchup.leaderManagerId === matchup.away.managerId}
              />
            </header>
            <div className="broadcast-h2h-squads">
              <div className="broadcast-pitch-markings" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
              <BroadcastSquad
                team={matchup.home}
                side="home"
                events={events}
                pendingEvents={pending}
                shirtCodesOverride={props.shirtCodesOverride}
              />
              <BroadcastSquad
                team={matchup.away}
                side="away"
                events={events}
                pendingEvents={pending}
                shirtCodesOverride={props.shirtCodesOverride}
              />
            </div>
          </section>
        )}
      </BroadcastFrame>
      {props.playerModal}
    </>
  )
}
