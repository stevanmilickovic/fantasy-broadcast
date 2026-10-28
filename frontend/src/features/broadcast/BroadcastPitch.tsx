import { Trophy } from 'lucide-react'
import { Fragment, useLayoutEffect, useRef, useState, useEffect, type RefObject } from 'react'
import { formatScoreline } from './broadcast'
import { BenchPlayer, PitchPlayer } from './BroadcastPlayers'
import {
  compactNotificationShiftFor,
  formationPosition,
  notificationShiftsFor,
  playerVerticalPosition,
  totalNotificationShifts,
  totalRowPlayerPosition,
} from './playerLayout'
import { shirtCodeFor } from '../../shared/fpl/shirts'
import { useShirtCodes } from '../../shared/fpl/useShirtCodes'
import type { FplClubShirt } from '../../shared/fpl/types'
import type { FantasyEventView, MatchupView, TeamView } from './types'

type ShirtCodes = FplClubShirt[]

export function PitchStage({
  shirtCodesOverride,
  gameweek,
  scoreline,
  leaderName,
  scoreRef,
  matchup,
  latestEvents,
  pendingEvents,
}: {
  shirtCodesOverride?: ShirtCodes
  gameweek: number
  scoreline: string
  leaderName: string
  scoreRef: RefObject<HTMLElement | null>
  matchup: MatchupView
  latestEvents: FantasyEventView[]
  pendingEvents: FantasyEventView[]
}) {
  const shirtCodes = useShirtCodes(shirtCodesOverride)
  return (
    <section className="pitch-panel pitch-panel-live">
      <div className="match-score-strip">
        <span>GW{gameweek}</span>
        <strong ref={scoreRef}>{formatScoreline(scoreline)}</strong>
        <small>
          <Trophy size={14} />
          {leaderName === 'No one' ? 'Level' : leaderName}
        </small>
      </div>
      <div className="pitch-and-benches">
        <BenchRail
          side="left"
          team={matchup.home}
          shirtCodes={shirtCodes}
          latestEvents={latestEvents}
          pendingEvents={pendingEvents}
        />
        <LivePitch
          matchup={matchup}
          shirtCodes={shirtCodes}
          latestEvents={latestEvents}
          pendingEvents={pendingEvents}
        />
        <BenchRail
          side="right"
          team={matchup.away}
          shirtCodes={shirtCodes}
          latestEvents={latestEvents}
          pendingEvents={pendingEvents}
        />
      </div>
      <CompactPlayerPanels
        matchup={matchup}
        shirtCodes={shirtCodes}
        latestEvents={latestEvents}
        pendingEvents={pendingEvents}
      />
    </section>
  )
}

function CompactPlayerPanels({
  matchup,
  shirtCodes,
  latestEvents,
  pendingEvents,
}: {
  matchup: MatchupView
  shirtCodes: ShirtCodes
  latestEvents: FantasyEventView[]
  pendingEvents: FantasyEventView[]
}) {
  return (
    <div className="compact-player-panels" aria-label="Matchup players">
      <CompactPlayerPanel
        side="home"
        team={matchup.home}
        shirtCodes={shirtCodes}
        latestEvents={latestEvents}
        pendingEvents={pendingEvents}
      />
      <CompactPlayerPanel
        side="away"
        team={matchup.away}
        shirtCodes={shirtCodes}
        latestEvents={latestEvents}
        pendingEvents={pendingEvents}
      />
    </div>
  )
}

function CompactPlayerPanel({
  side,
  team,
  shirtCodes,
  latestEvents,
  pendingEvents,
}: {
  side: 'home' | 'away'
  team: TeamView
  shirtCodes: ShirtCodes
  latestEvents: FantasyEventView[]
  pendingEvents: FantasyEventView[]
}) {
  const players = [
    ...team.activePlayers.filter((player) => player.position === 'FWD'),
    ...team.activePlayers.filter((player) => player.position === 'MID'),
    ...team.activePlayers.filter((player) => player.position === 'DEF'),
    ...team.activePlayers.filter((player) => player.position === 'GKP'),
    ...team.benchPlayers,
  ]
  const panelRef = useRef<HTMLElement>(null)
  const [panelBounds, setPanelBounds] = useState<DOMRect | null>(null)

  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const updateBounds = () => setPanelBounds(panel.getBoundingClientRect())
    const observer = new ResizeObserver(updateBounds)
    observer.observe(panel)
    window.addEventListener('resize', updateBounds)
    updateBounds()
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateBounds)
    }
  }, [])

  return (
    <section
      ref={panelRef}
      className={`compact-player-panel ${side}`}
      aria-label={`${team.clubName} players`}
    >
      <div className="compact-player-list">
        {players.map((player, index) => {
          const events = latestEvents.filter(
            (event) => event.managerId === team.managerId && event.playerId === player.id,
          )
          const pendingPointDelta =
            latestEvents.length === 0
              ? pendingEvents
                  .filter(
                    (event) => event.managerId === team.managerId && event.playerId === player.id,
                  )
                  .reduce((total, event) => total + event.pointDelta, 0)
              : 0
          return (
            <Fragment key={player.id}>
              {team.benchPlayers.length > 0 &&
                index === players.length - team.benchPlayers.length && (
                  <span className="compact-bench-label">Bench</span>
                )}
              <PitchPlayer
                player={player}
                side={side}
                teamColor={team.color}
                position={{ x: 50, y: 50, yOffset: 0 }}
                shirtCode={shirtCodeFor(player.premierLeagueClub, shirtCodes)}
                events={events}
                pendingPointDelta={pendingPointDelta}
                notificationShift={compactNotificationShiftFor(events, side, index, panelBounds)}
                compactLane={index % 2 === 0 ? 'outer' : 'inner'}
              />
            </Fragment>
          )
        })}
      </div>
    </section>
  )
}

function LivePitch({
  matchup,
  shirtCodes,
  latestEvents,
  pendingEvents,
}: {
  matchup: MatchupView
  shirtCodes: ShirtCodes
  latestEvents: FantasyEventView[]
  pendingEvents: FantasyEventView[]
}) {
  const pitchRef = useRef<HTMLElement>(null)
  const [pitchSize, setPitchSize] = useState({ width: 0, height: 0 })

  useLayoutEffect(() => {
    const pitch = pitchRef.current
    if (!pitch) return
    const updateSize = () => setPitchSize({ width: pitch.clientWidth, height: pitch.clientHeight })
    const observer = new ResizeObserver(updateSize)
    observer.observe(pitch)
    updateSize()
    return () => observer.disconnect()
  }, [])

  const notificationShifts = notificationShiftsFor(matchup, latestEvents, pitchSize)
  return (
    <section ref={pitchRef} className="live-pitch" aria-label="Live fantasy football pitch">
      <PitchMarkings />
      <PitchTeam
        side="home"
        team={matchup.home}
        shirtCodes={shirtCodes}
        latestEvents={latestEvents}
        pendingEvents={pendingEvents}
        notificationShifts={notificationShifts}
      />
      <PitchTeam
        side="away"
        team={matchup.away}
        shirtCodes={shirtCodes}
        latestEvents={latestEvents}
        pendingEvents={pendingEvents}
        notificationShifts={notificationShifts}
      />
    </section>
  )
}

function BenchRail({
  side,
  team,
  shirtCodes,
  latestEvents,
  pendingEvents,
}: {
  side: 'left' | 'right'
  team: TeamView
  shirtCodes: ShirtCodes
  latestEvents: FantasyEventView[]
  pendingEvents: FantasyEventView[]
}) {
  const goalkeeperHasNotification = team.activePlayers.some(
    (player) =>
      player.position === 'GKP' &&
      latestEvents.some(
        (event) => event.managerId === team.managerId && event.playerId === player.id,
      ),
  )
  return (
    <aside className={`bench-rail ${side}`} aria-label={`${team.clubName} bench`}>
      <span className="bench-rail-title">Bench</span>
      {team.benchPlayers.map((player, index) => {
        const shirtCode = shirtCodeFor(player.premierLeagueClub, shirtCodes)
        const verticalPosition = playerVerticalPosition(index, team.benchPlayers.length)
        const events = latestEvents.filter(
          (event) => event.managerId === team.managerId && event.playerId === player.id,
        )
        const pendingPointDelta =
          latestEvents.length === 0
            ? pendingEvents
                .filter(
                  (event) => event.managerId === team.managerId && event.playerId === player.id,
                )
                .reduce((total, event) => total + event.pointDelta, 0)
            : 0
        const notificationShift =
          goalkeeperHasNotification && Math.abs(verticalPosition.y - 50) < 20
            ? side === 'left'
              ? -88
              : 88
            : 0
        return (
          <BenchPlayer
            key={player.id}
            player={player}
            teamColor={team.color}
            shirtCode={shirtCode}
            verticalPosition={verticalPosition}
            events={events}
            pendingPointDelta={pendingPointDelta}
            notificationShift={notificationShift}
          />
        )
      })}
    </aside>
  )
}

function PitchTeam({
  side,
  team,
  shirtCodes,
  latestEvents,
  pendingEvents,
  notificationShifts,
}: {
  side: 'home' | 'away'
  team: TeamView
  shirtCodes: ShirtCodes
  latestEvents: FantasyEventView[]
  pendingEvents: FantasyEventView[]
  notificationShifts: Map<string, number>
}) {
  return (
    <>
      {team.activePlayers.map((player) => {
        const position = formationPosition(team.activePlayers, player, side)
        const events = latestEvents.filter(
          (event) => event.managerId === team.managerId && event.playerId === player.id,
        )
        const pendingPointDelta =
          latestEvents.length === 0
            ? pendingEvents
                .filter(
                  (event) => event.managerId === team.managerId && event.playerId === player.id,
                )
                .reduce((total, event) => total + event.pointDelta, 0)
            : 0
        return (
          <PitchPlayer
            key={player.id}
            player={player}
            side={side}
            teamColor={team.color}
            position={position}
            shirtCode={shirtCodeFor(player.premierLeagueClub, shirtCodes)}
            events={events}
            pendingPointDelta={pendingPointDelta}
            notificationShift={notificationShifts.get(player.id) ?? 0}
          />
        )
      })}
    </>
  )
}

export function TotalPointsPlayerRows({
  team,
  shirtCodes,
  latestEvents,
  pendingEvents,
}: {
  team: TeamView
  shirtCodes: ShirtCodes
  latestEvents: FantasyEventView[]
  pendingEvents: FantasyEventView[]
}) {
  const rowsRef = useRef<HTMLElement>(null)
  const [width, setWidth] = useState(0)
  const rows = [
    ['FWD', 'Forwards', team.activePlayers.filter((player) => player.position === 'FWD')],
    ['MID', 'Midfielders', team.activePlayers.filter((player) => player.position === 'MID')],
    ['DEF', 'Defenders', team.activePlayers.filter((player) => player.position === 'DEF')],
    ['GKP', 'Goalkeeper', team.activePlayers.filter((player) => player.position === 'GKP')],
    ['BENCH', 'Bench', team.benchPlayers],
  ] as const
  useEffect(() => {
    const element = rowsRef.current
    if (!element) return
    const update = () => setWidth(element.clientWidth)
    const observer = new ResizeObserver(update)
    observer.observe(element)
    update()
    return () => observer.disconnect()
  }, [])
  const notificationShifts = totalNotificationShifts(rows, team.managerId, latestEvents, width)
  return (
    <section ref={rowsRef} className="total-player-rows" aria-label={`${team.clubName} players`}>
      {rows.map(
        ([key, label, players]) =>
          players.length > 0 && (
            <section className="total-player-row" key={key}>
              <span>{label}</span>
              <div>
                {players.map((player, index) => {
                  const events = latestEvents.filter(
                    (event) => event.managerId === team.managerId && event.playerId === player.id,
                  )
                  const pendingPointDelta =
                    latestEvents.length === 0
                      ? pendingEvents
                          .filter(
                            (event) =>
                              event.managerId === team.managerId && event.playerId === player.id,
                          )
                          .reduce((total, event) => total + event.pointDelta, 0)
                      : 0
                  return (
                    <PitchPlayer
                      key={player.id}
                      player={player}
                      side="home"
                      teamColor={team.color}
                      position={totalRowPlayerPosition(index, players.length, width)}
                      shirtCode={shirtCodeFor(player.premierLeagueClub, shirtCodes)}
                      events={events}
                      pendingPointDelta={pendingPointDelta}
                      notificationShift={notificationShifts.get(player.id) ?? 0}
                    />
                  )
                })}
              </div>
            </section>
          ),
      )}
    </section>
  )
}

function PitchMarkings() {
  return (
    <>
      <span className="pitch-halfway" />
      <span className="pitch-centre-circle" />
      <span className="pitch-centre-spot" />
      <span className="pitch-area left-area" />
      <span className="pitch-area right-area" />
    </>
  )
}
