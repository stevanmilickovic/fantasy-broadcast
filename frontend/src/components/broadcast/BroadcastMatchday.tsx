import { ArrowLeft, Radio, Trophy, Volume2 } from 'lucide-react'
import type { CSSProperties, RefObject } from 'react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { BroadcastFocus, FantasyEventView, LiveStandingView, LiveStateResponse, MatchupView, PlayerView, RevealLayout, RevealRect, TeamView } from '../../types/live'
import { formatScoreline, playerCardName, revealCopyStyle, teamShortName, TOTAL_POINTS_REVEAL_TEAM_SCALE } from '../../utils/broadcast'

type BroadcastMatchdayProps = {
	authToken: string
	shirtCodesOverride?: ShirtCodes
	displayLiveState: LiveStateResponse
	matchup?: MatchupView
	latestCommentaryId?: string
	latestCommentaryText: string
  latestCommentaryStatus: string
  leaderName: string
  broadcastFocus: BroadcastFocus
  automaticFocus: BroadcastFocus
  revealingMatch: boolean
  revealLayout: RevealLayout | null
  transitioningToMatch: boolean
  visibleEventId: string | null
  homeHeadingRef: RefObject<HTMLHeadingElement | null>
  awayHeadingRef: RefObject<HTMLHeadingElement | null>
  scoreRef: RefObject<HTMLElement | null>
  totalTeamNameRef: RefObject<HTMLSpanElement | null>
  totalHeadingRef: RefObject<HTMLHeadingElement | null>
  standings: LiveStandingView[]
  showingLiveLeaderboard: boolean
  leaderboardRevealLayout: RevealRect | null
  leaderboardHeadingRef: RefObject<HTMLHeadingElement | null>
  holdingPendingUpdates: boolean
  onBack: () => void
  onSelectFocus: (focus: BroadcastFocus) => void
}

type FplClubShirt = { name: string; shortName?: string; code: number }
type ShirtCodes = FplClubShirt[]
const REVEAL_SCORE_CLEARANCE_PX = 42
const COMPACT_COMPONENT_SCALE = 1.2
const COMPACT_NOTIFICATION_SCREEN_INSET_RATIO = .05
const COMPACT_PLAYER_TOKEN_WIDTH = 92

const notificationTopFor = (index: number) => {
  const metadataHeight = window.matchMedia('(max-width: 900px)').matches ? 20 : 26
  return 29 + index * (metadataHeight - 1)
}

export function BroadcastMatchday({
	authToken, shirtCodesOverride, displayLiveState, matchup, latestCommentaryId, latestCommentaryText, latestCommentaryStatus, leaderName, broadcastFocus, automaticFocus,
  revealingMatch, revealLayout, transitioningToMatch, visibleEventId, homeHeadingRef, awayHeadingRef, scoreRef, totalTeamNameRef, totalHeadingRef, standings, showingLiveLeaderboard, leaderboardRevealLayout, leaderboardHeadingRef, holdingPendingUpdates,
  onBack, onSelectFocus,
}: BroadcastMatchdayProps) {
  const displayLatestEvent = displayLiveState.events?.[0]
  const displayEvents = visibleEventId === displayLatestEvent?.id ? displayLiveState.events : []
  if (!matchup && (displayLiveState.teams?.length ?? 0) > 0) {
    return <TotalPointsBroadcast
		authToken={authToken}
		shirtCodesOverride={shirtCodesOverride}
      displayLiveState={displayLiveState}
      broadcastFocus={broadcastFocus}
      automaticFocus={automaticFocus}
      revealingMatch={revealingMatch}
      revealLayout={revealLayout}
      transitioningToMatch={transitioningToMatch}
      latestEvent={displayLatestEvent}
      latestEvents={displayEvents}
      pendingEvents={holdingPendingUpdates ? displayLiveState.events ?? [] : []}
      latestCommentaryId={latestCommentaryId}
      latestCommentaryText={latestCommentaryText}
      latestCommentaryStatus={latestCommentaryStatus}
      standings={standings}
      showingLiveLeaderboard={showingLiveLeaderboard}
      leaderboardRevealLayout={leaderboardRevealLayout}
      leaderboardHeadingRef={leaderboardHeadingRef}
      totalTeamNameRef={totalTeamNameRef}
      totalHeadingRef={totalHeadingRef}
      scoreRef={scoreRef}
      onBack={onBack}
      onSelectFocus={onSelectFocus}
    />
  }
  if (!matchup) return null
  return (
    <main className={`broadcast-shell matchday-page ${revealingMatch ? 'revealing-match' : ''}`}>
      {transitioningToMatch && <div className="scene-wipe-overlay" aria-hidden="true" />}
      {revealingMatch && (showingLiveLeaderboard
        ? <LeaderboardReveal layout={leaderboardRevealLayout} headingRef={leaderboardHeadingRef} />
        : <MatchReveal layout={revealLayout} matchup={matchup} homeHeadingRef={homeHeadingRef} awayHeadingRef={awayHeadingRef} scoreRef={scoreRef} />)}
      <button className="floating-back" type="button" onClick={onBack}><ArrowLeft size={18} />Back</button>
      <div className="live-indicator"><Radio size={16} /><span>Live</span></div>
      <NarrationCaption id={latestCommentaryId} text={latestCommentaryText} status={latestCommentaryStatus} />
      <MatchSelector latestEvent={displayLatestEvent} matchups={displayLiveState.matchups} selectedFocus={broadcastFocus} onSelect={onSelectFocus} />

      {showingLiveLeaderboard
        ? <HeadToHeadLeaderboard standings={standings} headingRef={leaderboardHeadingRef} />
        : <section className="matchday-stage pitch-broadcast-stage" aria-label="Focused matchup broadcast">
            <BroadcastTeamColumn side="left" team={matchup.home} isLeader={matchup.leaderManagerId === matchup.home.managerId} headingRef={homeHeadingRef} />
            <PitchStage authToken={authToken} shirtCodesOverride={shirtCodesOverride} gameweek={displayLiveState.gameweek} scoreline={matchup.scoreline} leaderName={leaderName} scoreRef={scoreRef} matchup={matchup} latestEvents={displayEvents} pendingEvents={holdingPendingUpdates ? displayLiveState.events ?? [] : []} />
            <BroadcastTeamColumn side="right" team={matchup.away} isLeader={matchup.leaderManagerId === matchup.away.managerId} headingRef={awayHeadingRef} />
          </section>}
    </main>
  )
}

function HeadToHeadLeaderboard({ standings, headingRef }: {
  standings: LiveStandingView[]
  headingRef: RefObject<HTMLHeadingElement | null>
}) {
  return <section className="live-leaderboard-page" aria-label="Live leaderboard">
    <LiveStandings standings={standings} headingRef={headingRef} label="Live Leaderboard" showUnsignedLivePoints />
  </section>
}

function LeaderboardReveal({ layout, headingRef, label = 'Live Leaderboard' }: { layout: RevealRect | null; headingRef: RefObject<HTMLHeadingElement | null>; label?: string }) {
  const [typography, setTypography] = useState<CSSProperties>()
  useLayoutEffect(() => {
    const heading = headingRef.current
    if (!heading) return
    const style = window.getComputedStyle(heading)
    setTypography({
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      fontStyle: style.fontStyle,
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing,
      textTransform: style.textTransform,
      textShadow: style.textShadow,
    })
  }, [headingRef, layout])
  if (!layout) return null
  return <div className="match-reveal-overlay leaderboard-reveal" aria-hidden="true"><div className="match-reveal-sheet" /><strong className="match-reveal-copy leaderboard-reveal-copy" style={{ ...revealCopyStyle(layout, 1), ...typography }}>{label}</strong></div>
}

function NarrationCaption({ id, text, status }: { id?: string; text: string; status: string }) {
	const waiting = status === 'WAITING'
	if (waiting || !id) return null
	return <aside key={id ?? 'waiting'} className={`narration-caption ${waiting ? 'waiting' : 'has-commentary'}`} aria-live="polite">
    <Volume2 size={16} />
		<span><small>AI-generated commentary</small>{text}</span>
  </aside>
}

function MatchSelector({ matchups, latestEvent, selectedFocus, onSelect }: { matchups: MatchupView[]; latestEvent?: FantasyEventView; selectedFocus: BroadcastFocus; onSelect: (focus: BroadcastFocus) => void }) {
  return <nav className="match-selector" aria-label="Ongoing match selector">
    <button className={`match-selector-chip multiview-chip ${selectedFocus === 'multi' ? 'selected-match-chip' : ''}`} type="button" onClick={() => onSelect('multi')}><Radio size={14} /><span>Multi</span></button>
    <div className="match-chip-track">{matchups.map((matchup) => <MatchSelectorChip key={matchup.id} latestEvent={latestEvent} matchup={matchup} selected={selectedFocus === matchup.id} onSelect={() => onSelect(matchup.id)} />)}</div>
  </nav>
}

function MatchSelectorChip({ matchup, latestEvent, selected, onSelect }: { matchup: MatchupView; latestEvent?: FantasyEventView; selected: boolean; onSelect: () => void }) {
  const homeChanged = latestEvent?.managerId === matchup.home.managerId
  const awayChanged = latestEvent?.managerId === matchup.away.managerId
  return <button className={`match-selector-chip ${selected ? 'selected-match-chip' : ''} ${homeChanged || awayChanged ? 'match-chip-event' : ''}`} type="button" onClick={onSelect}>
    <span className="match-chip-team">{teamShortName(matchup.home)}</span><MatchChipScore changed={homeChanged} delta={homeChanged && latestEvent ? latestEvent.pointDelta : 0} eventId={homeChanged ? latestEvent?.id : undefined} score={matchup.home.score} side="left" />
    <span className="match-chip-separator">-</span><MatchChipScore changed={awayChanged} delta={awayChanged && latestEvent ? latestEvent.pointDelta : 0} eventId={awayChanged ? latestEvent?.id : undefined} score={matchup.away.score} side="right" /><span className="match-chip-team">{teamShortName(matchup.away)}</span>
  </button>
}

function MatchChipScore({ score, changed, delta, eventId, side }: { score: number; changed: boolean; delta: number; eventId?: string; side: 'left' | 'right' }) {
  const previousScore = changed ? score - delta : score
  const [displayScore, setDisplayScore] = useState(changed ? previousScore : score)
  useEffect(() => {
    if (!changed || !eventId || delta === 0) {
      const resetTimer = window.setTimeout(() => setDisplayScore(score), 0)
      return () => window.clearTimeout(resetTimer)
    }
    const step = delta > 0 ? 1 : -1
    let timer: number | undefined
    const startTimer = window.setTimeout(() => {
      setDisplayScore(previousScore)
      timer = window.setInterval(() => setDisplayScore((value) => value === score ? value : value + step), 120)
    }, 0)
    return () => { window.clearTimeout(startTimer); if (timer) window.clearInterval(timer) }
  }, [changed, delta, eventId, previousScore, score])
  return <div className={`match-chip-score ${changed ? 'changed-score' : ''}`}>{side === 'left' && changed && delta !== 0 && <span className="match-chip-delta">{delta > 0 ? '+' : ''}{delta}</span>}<span className="match-chip-total">{displayScore}</span>{side === 'right' && changed && delta !== 0 && <span className="match-chip-delta">{delta > 0 ? '+' : ''}{delta}</span>}</div>
}

function BroadcastTeamColumn({ side, team, isLeader, headingRef }: { side: 'left' | 'right'; team: TeamView; isLeader: boolean; headingRef: RefObject<HTMLHeadingElement | null> }) {
  useLayoutEffect(() => {
    const heading = headingRef.current
    const container = heading?.parentElement
    if (!heading || !container) return
    const fitName = () => {
      heading.style.fontSize = ''
      const computedStyle = window.getComputedStyle(heading)
      const naturalSize = Number.parseFloat(computedStyle.fontSize)
      const availableWidth = container.clientWidth
      const context = document.createElement('canvas').getContext('2d')
      if (!context || !availableWidth) return
      context.font = `${computedStyle.fontWeight} ${naturalSize}px ${computedStyle.fontFamily}`
      const textWidth = context.measureText(team.clubName).width
      const safeWidth = Math.max(1, availableWidth - 10)
      if (textWidth <= safeWidth) return
      heading.style.fontSize = `${Math.max(8, Math.floor(naturalSize * safeWidth / textWidth))}px`
    }
    const resizeObserver = new ResizeObserver(fitName)
    resizeObserver.observe(container)
    fitName()
    const layoutFrame = window.requestAnimationFrame(fitName)
    return () => {
      resizeObserver.disconnect()
      window.cancelAnimationFrame(layoutFrame)
    }
  }, [headingRef, team.clubName])

  return <section className={`broadcast-team-column ${side}`} style={{ '--team-color': team.color } as CSSProperties}>
    <div className="broadcast-team-heading">
    <span>{teamShortName(team)}</span><h2 ref={headingRef}>{team.clubName}</h2><p>{team.displayName}</p><strong className={isLeader ? '' : 'leader-placeholder'}>Leading</strong>
    </div>
  </section>
}

function PitchStage({ authToken, shirtCodesOverride, gameweek, scoreline, leaderName, scoreRef, matchup, latestEvents, pendingEvents }: { authToken: string; shirtCodesOverride?: ShirtCodes; gameweek: number; scoreline: string; leaderName: string; scoreRef: RefObject<HTMLElement | null>; matchup: MatchupView; latestEvents: FantasyEventView[]; pendingEvents: FantasyEventView[] }) {
	const shirtCodes = useShirtCodes(authToken, shirtCodesOverride)
  return <section className="pitch-panel pitch-panel-live">
    <div className="match-score-strip"><span>GW{gameweek}</span><strong ref={scoreRef}>{formatScoreline(scoreline)}</strong><small><Trophy size={14} />{leaderName === 'No one' ? 'Level' : leaderName}</small></div>
    <div className="pitch-and-benches">
      <BenchRail side="left" team={matchup.home} shirtCodes={shirtCodes} latestEvents={latestEvents} pendingEvents={pendingEvents} />
      <LivePitch matchup={matchup} shirtCodes={shirtCodes} latestEvents={latestEvents} pendingEvents={pendingEvents} />
      <BenchRail side="right" team={matchup.away} shirtCodes={shirtCodes} latestEvents={latestEvents} pendingEvents={pendingEvents} />
    </div>
    <CompactPlayerPanels matchup={matchup} shirtCodes={shirtCodes} latestEvents={latestEvents} pendingEvents={pendingEvents} />
  </section>
}

/**
 * The pitch becomes unreadable before the rest of the broadcast does. In compact
 * layouts, keep the same player cards but reserve the five visible slots for the
 * scorers and temporarily promote any player involved in the current notification.
 */
function CompactPlayerPanels({ matchup, shirtCodes, latestEvents, pendingEvents }: { matchup: MatchupView; shirtCodes: ShirtCodes; latestEvents: FantasyEventView[]; pendingEvents: FantasyEventView[] }) {
  return <div className="compact-player-panels" aria-label="Leading fantasy scorers">
    <CompactPlayerPanel side="home" team={matchup.home} shirtCodes={shirtCodes} latestEvents={latestEvents} pendingEvents={pendingEvents} />
    <CompactPlayerPanel side="away" team={matchup.away} shirtCodes={shirtCodes} latestEvents={latestEvents} pendingEvents={pendingEvents} />
  </div>
}

function CompactPlayerPanel({ side, team, shirtCodes, latestEvents, pendingEvents }: { side: 'home' | 'away'; team: TeamView; shirtCodes: ShirtCodes; latestEvents: FantasyEventView[]; pendingEvents: FantasyEventView[] }) {
  const players = compactPlayersFor(team, latestEvents)
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

  return <section ref={panelRef} className={`compact-player-panel ${side}`} aria-label={`${team.clubName} leading scorers`}>
    <span className="compact-player-panel-label">Top scorers</span>
    <div className="compact-player-list">
      {players.map((player) => {
        const events = latestEvents.filter((event) => event.managerId === team.managerId && event.playerId === player.id)
        const pendingPointDelta = latestEvents.length === 0
          ? pendingEvents.filter((event) => event.managerId === team.managerId && event.playerId === player.id).reduce((total, event) => total + event.pointDelta, 0)
          : 0
        return <PitchPlayer key={player.id} player={player} side={side} teamColor={team.color} position={{ x: 50, y: 50, yOffset: 0 }} shirtCode={shirtCodeFor(player.premierLeagueClub, shirtCodes)} events={events} pendingPointDelta={pendingPointDelta} notificationShift={compactNotificationShiftFor(events, side, panelBounds)} />
      })}
    </div>
  </section>
}

function compactPlayersFor(team: TeamView, latestEvents: FantasyEventView[]) {
  const players = [...team.activePlayers, ...team.benchPlayers]
  const notifiedIds = new Set(latestEvents.filter((event) => event.managerId === team.managerId).map((event) => event.playerId))
  const byPoints = [...players].sort((first, second) => second.points - first.points || first.displayName.localeCompare(second.displayName))
  const promoted = players.filter((player) => notifiedIds.has(player.id))
  return [...promoted, ...byPoints.filter((player) => !notifiedIds.has(player.id))].slice(0, 5)
}

function compactNotificationShiftFor(events: FantasyEventView[], side: 'home' | 'away', panelBounds: DOMRect | null) {
  if (events.length === 0 || !panelBounds) return 0
  const screenInset = window.innerWidth * COMPACT_NOTIFICATION_SCREEN_INSET_RATIO
  const halfScreenEdge = window.innerWidth / 2
  const leftBound = side === 'home' ? screenInset : halfScreenEdge + screenInset
  const rightBound = side === 'home' ? halfScreenEdge - screenInset : window.innerWidth - screenInset
  const notificationWidth = Math.min(
    Math.max(...events.map(notificationWidthFor)) * COMPACT_COMPONENT_SCALE,
    rightBound - leftBound,
  )
  // Compact cards are anchored to their panel's outer edge. Measure that edge instead
  // of applying a blanket inward offset, so a card moves only when it would clip.
  const notificationCentre = side === 'home'
    ? panelBounds.left + COMPACT_PLAYER_TOKEN_WIDTH * COMPACT_COMPONENT_SCALE / 2
    : panelBounds.right - COMPACT_PLAYER_TOKEN_WIDTH * COMPACT_COMPONENT_SCALE / 2
  const notificationLeft = notificationCentre - notificationWidth / 2
  const notificationRight = notificationCentre + notificationWidth / 2
  if (notificationLeft < leftBound) return (leftBound - notificationLeft) / COMPACT_COMPONENT_SCALE
  if (notificationRight > rightBound) return (rightBound - notificationRight) / COMPACT_COMPONENT_SCALE
  return 0
}

function LivePitch({ matchup, shirtCodes, latestEvents, pendingEvents }: { matchup: MatchupView; shirtCodes: ShirtCodes; latestEvents: FantasyEventView[]; pendingEvents: FantasyEventView[] }) {
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
  return <section ref={pitchRef} className="live-pitch" aria-label="Live fantasy football pitch">
    <PitchMarkings />
    <PitchTeam side="home" team={matchup.home} shirtCodes={shirtCodes} latestEvents={latestEvents} pendingEvents={pendingEvents} notificationShifts={notificationShifts} />
    <PitchTeam side="away" team={matchup.away} shirtCodes={shirtCodes} latestEvents={latestEvents} pendingEvents={pendingEvents} notificationShifts={notificationShifts} />
  </section>
}

function BenchRail({ side, team, shirtCodes, latestEvents, pendingEvents }: { side: 'left' | 'right'; team: TeamView; shirtCodes: ShirtCodes; latestEvents: FantasyEventView[]; pendingEvents: FantasyEventView[] }) {
  const goalkeeperHasNotification = team.activePlayers.some((player) => player.position === 'GKP' && latestEvents.some((event) => event.managerId === team.managerId && event.playerId === player.id))
  return <aside className={`bench-rail ${side}`} aria-label={`${team.clubName} bench`}>
    <span className="bench-rail-title">Bench</span>
    {team.benchPlayers.map((player, index) => {
      const shirtCode = shirtCodeFor(player.premierLeagueClub, shirtCodes)
      const verticalPosition = playerVerticalPosition(index, team.benchPlayers.length)
      const events = latestEvents.filter((event) => event.managerId === team.managerId && event.playerId === player.id)
      const pendingPointDelta = latestEvents.length === 0 ? pendingEvents.filter((event) => event.managerId === team.managerId && event.playerId === player.id).reduce((total, event) => total + event.pointDelta, 0) : 0
      const notificationShift = goalkeeperHasNotification && Math.abs(verticalPosition.y - 50) < 20 ? side === 'left' ? -88 : 88 : 0
      return <BenchPlayer key={player.id} player={player} teamColor={team.color} shirtCode={shirtCode} verticalPosition={verticalPosition} events={events} pendingPointDelta={pendingPointDelta} notificationShift={notificationShift} />
    })}
  </aside>
}

function BenchPlayer({ player, teamColor, shirtCode, verticalPosition, events, pendingPointDelta, notificationShift }: { player: PlayerView; teamColor: string; shirtCode?: number; verticalPosition: { y: number; yOffset: number }; events: FantasyEventView[]; pendingPointDelta: number; notificationShift: number }) {
  const name = playerCardName(player).join(' ').trim()
  const shirtUrl = shirtCode ? `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${shirtCode}-66.png` : undefined
  const [notificationEventId, setNotificationEventId] = useState<string | null>(null)
  const [notificationLeaving, setNotificationLeaving] = useState(false)
  const [displayedPoints, setDisplayedPoints] = useState(player.points)
  const [retainedEvent, setRetainedEvent] = useState<FantasyEventView | undefined>(undefined)
  const event = events[0]
  const activeEvents = event ? events : retainedEvent ? [retainedEvent] : []
  const activeEvent = activeEvents[0]
  const eventDelta = events.reduce((total, candidate) => total + candidate.pointDelta, 0)
  const eventWidth = Math.max(108, ...activeEvents.map(notificationWidthFor))
  const metadataWidth = 26 + Math.min(82, Math.max(34, name.length * 6 + 12))
  const style = { '--team-color': teamColor, '--y': `${verticalPosition.y}%`, '--y-offset': `${verticalPosition.yOffset}px`, '--event-width': `${eventWidth}px`, '--metadata-width': `${metadataWidth}px`, '--event-shift': `${notificationShift}px` } as CSSProperties
  const pointsToRender = event && notificationEventId !== event.id ? player.points - eventDelta : !event && pendingPointDelta !== 0 ? player.points - pendingPointDelta : displayedPoints

  useEffect(() => {
    if (!event) {
      if (!retainedEvent) { setNotificationEventId(null); setNotificationLeaving(false); setDisplayedPoints(player.points); return }
      setNotificationLeaving(true)
      const removeTimer = window.setTimeout(() => { setNotificationEventId(null); setNotificationLeaving(false); setRetainedEvent(undefined); setDisplayedPoints(player.points) }, 200)
      return () => window.clearTimeout(removeTimer)
    }
    const startingPoints = player.points - eventDelta
    setRetainedEvent(event); setNotificationEventId(null); setNotificationLeaving(false); setDisplayedPoints(startingPoints)
    let pointsTimer: number | undefined
    const notificationTimer = window.setTimeout(() => {
      setNotificationEventId(event.id)
      if (event.pointDelta === 0) return
      const increment = event.pointDelta > 0 ? 1 : -1
      pointsTimer = window.setInterval(() => setDisplayedPoints((current) => {
        const next = current + increment
        if ((increment > 0 && next >= player.points) || (increment < 0 && next <= player.points)) { if (pointsTimer) window.clearInterval(pointsTimer); return player.points }
        return next
      }), Math.max(70, Math.round(360 / Math.abs(event.pointDelta))))
    }, 240)
    return () => { window.clearTimeout(notificationTimer); if (pointsTimer) window.clearInterval(pointsTimer) }
  }, [event?.id, eventDelta, player.points])

  return <div className={`bench-player ${activeEvent ? 'has-event' : ''}`} style={style}>
    <div className={`player-token bench-player-token ${activeEvent ? 'has-event' : ''} ${notificationLeaving ? 'is-leaving' : ''}`}><div className="player-core"><div className="shirt-wrap">{shirtUrl ? <img src={shirtUrl} alt={`${player.premierLeagueClub} shirt`} /> : <span>{name}</span>}</div><div className={`player-event-stack ${activeEvent ? 'has-event' : ''} ${notificationLeaving ? 'is-leaving' : ''}`}><div className="player-meta"><strong>{name}</strong><b>{displayPlayerPoints(player, pointsToRender)}</b></div>{activeEvent && notificationEventId === activeEvent.id && activeEvents.map((candidate, index) => <span key={candidate.id} className={`player-event-notification ${notificationLeaving ? 'is-leaving' : ''}`} style={{ '--notification-top': `${notificationTopFor(index)}px`, '--notification-delay': `${index * 140}ms` } as CSSProperties}><strong>{candidate.type.replaceAll('_', ' ')}</strong><span>{candidate.pointDelta > 0 ? '+' : ''}{candidate.pointDelta} pts</span></span>)}</div></div></div>
  </div>
}

function useShirtCodes(token: string, shirtCodesOverride?: ShirtCodes): ShirtCodes {
  const [codes, setCodes] = useState<ShirtCodes>([])
  useEffect(() => {
    if (shirtCodesOverride) return
    let alive = true
		fetch('/api/customer/fpl/shirts')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load shirts')))
      .then((teams: FplClubShirt[]) => {
        if (!alive) return
        setCodes(teams)
        teams.forEach((team) => {
          ;[66, 110].forEach((size) => {
            const shirt = new Image()
            shirt.src = `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${team.code}-${size}.png`
          })
        })
      }).catch(() => undefined)
    return () => { alive = false }
  }, [shirtCodesOverride, token])
  return shirtCodesOverride ?? codes
}

function PitchTeam({ side, team, shirtCodes, latestEvents, pendingEvents, notificationShifts }: { side: 'home' | 'away'; team: TeamView; shirtCodes: ShirtCodes; latestEvents: FantasyEventView[]; pendingEvents: FantasyEventView[]; notificationShifts: Map<string, number> }) {
  return <>{team.activePlayers.map((player) => {
    const position = formationPosition(team.activePlayers, player, side)
    const events = latestEvents.filter((event) => event.managerId === team.managerId && event.playerId === player.id)
    const pendingPointDelta = latestEvents.length === 0 ? pendingEvents.filter((event) => event.managerId === team.managerId && event.playerId === player.id).reduce((total, event) => total + event.pointDelta, 0) : 0
    return <PitchPlayer key={player.id} player={player} side={side} teamColor={team.color} position={position} shirtCode={shirtCodeFor(player.premierLeagueClub, shirtCodes)} events={events} pendingPointDelta={pendingPointDelta} notificationShift={notificationShifts.get(player.id) ?? 0} />
  })}</>
}

function PitchPlayer({ player, side, teamColor, position, shirtCode, events, pendingPointDelta = 0, notificationShift }: { player: PlayerView; side: 'home' | 'away'; teamColor: string; position: { x: number; y: number; yOffset: number }; shirtCode?: number; events: FantasyEventView[]; pendingPointDelta?: number; notificationShift: number }) {
  const name = playerCardName(player).join(' ').trim()
  const shirtUrl = shirtCode ? `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${shirtCode}-110.png` : undefined
  const style = { '--x': `${position.x}%`, '--y': `${position.y}%`, '--y-offset': `${position.yOffset}px`, '--team-color': teamColor } as CSSProperties
  const [notificationEventId, setNotificationEventId] = useState<string | null>(null)
  const [notificationLeaving, setNotificationLeaving] = useState(false)
  const [displayedPoints, setDisplayedPoints] = useState(player.points)
  const [retainedEvent, setRetainedEvent] = useState<FantasyEventView | undefined>(undefined)
  const event = events[0]
  const activeEvents = event ? events : retainedEvent ? [retainedEvent] : []
  const activeEvent = activeEvents[0]
  const eventDelta = events.reduce((total, candidate) => total + candidate.pointDelta, 0)
  // This is based on the actual notification content, not a one-size event card.
  const eventWidth = Math.max(108, ...activeEvents.map(notificationWidthFor))
  const metadataWidth = 26 + Math.min(82, Math.max(34, name.length * 6 + 12))
  const eventStyle = { '--event-width': `${eventWidth}px`, '--metadata-width': `${metadataWidth}px`, '--event-shift': `${notificationShift}px` } as CSSProperties
  const pointsToRender = event && notificationEventId !== event.id ? player.points - eventDelta : !event && pendingPointDelta !== 0 ? player.points - pendingPointDelta : displayedPoints

  useEffect(() => {
    if (!event) {
      if (!retainedEvent) {
        setNotificationEventId(null)
        setNotificationLeaving(false)
        setDisplayedPoints(player.points)
        return
      }
      setNotificationLeaving(true)
      const removeTimer = window.setTimeout(() => {
        setNotificationEventId(null)
        setNotificationLeaving(false)
        setRetainedEvent(undefined)
        setDisplayedPoints(player.points)
      }, 200)
      return () => window.clearTimeout(removeTimer)
    }
    const startingPoints = player.points - eventDelta
    setRetainedEvent(event)
    setNotificationEventId(null)
    setNotificationLeaving(false)
    setDisplayedPoints(startingPoints)
    let pointsTimer: number | undefined
    const notificationTimer = window.setTimeout(() => {
      setNotificationEventId(event.id)
      if (event.pointDelta === 0) return
      const increment = event.pointDelta > 0 ? 1 : -1
      pointsTimer = window.setInterval(() => {
        setDisplayedPoints((current) => {
          const next = current + increment
          if ((increment > 0 && next >= player.points) || (increment < 0 && next <= player.points)) {
            if (pointsTimer) window.clearInterval(pointsTimer)
            return player.points
          }
          return next
        })
      }, Math.max(70, Math.round(360 / Math.abs(event.pointDelta))))
    }, 240)
    return () => {
      window.clearTimeout(notificationTimer)
      if (pointsTimer) window.clearInterval(pointsTimer)
    }
  }, [event?.id, eventDelta, player.points])

  return <div className={`pitch-player ${side} ${activeEvent ? 'has-event' : ''} ${player.autoSubstituted ? 'auto-substituted' : ''}`} style={style}>
    <div className={`player-token ${activeEvent ? 'has-event' : ''} ${notificationLeaving ? 'is-leaving' : ''}`}><div className="player-core"><div className="shirt-wrap">{shirtUrl ? <img src={shirtUrl} alt={`${player.premierLeagueClub} shirt`} /> : <span>{name}</span>}</div><div className={`player-event-stack ${activeEvent ? 'has-event' : ''} ${notificationLeaving ? 'is-leaving' : ''}`} style={activeEvent ? eventStyle : undefined}><div className="player-meta"><strong>{name}</strong><b>{displayPlayerPoints(player, pointsToRender)}</b></div>{activeEvent && notificationEventId === activeEvent.id && activeEvents.map((candidate, index) => <span key={candidate.id} className={`player-event-notification ${notificationLeaving ? 'is-leaving' : ''}`} style={{ '--notification-top': `${notificationTopFor(index)}px`, '--notification-delay': `${index * 140}ms` } as CSSProperties}><strong>{candidate.type.replaceAll('_', ' ')}</strong><span>{candidate.pointDelta > 0 ? '+' : ''}{candidate.pointDelta} pts</span></span>)}</div></div></div>
  </div>
}

function TotalPointsBroadcast({ authToken, shirtCodesOverride, displayLiveState, broadcastFocus, automaticFocus, revealingMatch, revealLayout, transitioningToMatch, latestEvent, latestEvents, pendingEvents, latestCommentaryId, latestCommentaryText, latestCommentaryStatus, standings, showingLiveLeaderboard, leaderboardRevealLayout, leaderboardHeadingRef, totalTeamNameRef, totalHeadingRef, scoreRef, onBack, onSelectFocus }: {
	authToken: string
  shirtCodesOverride?: ShirtCodes
  displayLiveState: LiveStateResponse
  broadcastFocus: BroadcastFocus
  automaticFocus: BroadcastFocus
  revealingMatch: boolean
  revealLayout: RevealLayout | null
  transitioningToMatch: boolean
  latestEvent?: FantasyEventView
  latestEvents: FantasyEventView[]
	pendingEvents: FantasyEventView[]
	latestCommentaryId?: string
	latestCommentaryText: string
  latestCommentaryStatus: string
  standings: LiveStandingView[]
  showingLiveLeaderboard: boolean
  leaderboardRevealLayout: RevealRect | null
  leaderboardHeadingRef: RefObject<HTMLHeadingElement | null>
  totalTeamNameRef: RefObject<HTMLSpanElement | null>
  totalHeadingRef: RefObject<HTMLHeadingElement | null>
  scoreRef: RefObject<HTMLElement | null>
  onBack: () => void
  onSelectFocus: (focus: BroadcastFocus) => void
}) {
  const automaticallyFocusedTeam = automaticFocus !== 'multi'
    ? displayLiveState.teams?.find((candidate) => candidate.managerId === automaticFocus)
    : latestEvent
      ? displayLiveState.teams?.find((candidate) => candidate.managerId === latestEvent.managerId)
      : undefined
  const selectedTeam = broadcastFocus === 'multi' ? undefined : displayLiveState.teams?.find((candidate) => candidate.managerId === broadcastFocus)
  const team = selectedTeam ?? automaticallyFocusedTeam ?? displayLiveState.teams?.[0]
  if (!team) return null
  const shirtCodes = useShirtCodes(authToken, shirtCodesOverride)
  useLayoutEffect(() => {
    const heading = totalHeadingRef.current
    const teamName = totalTeamNameRef.current
    const score = scoreRef.current
    if (!heading || !teamName || !score) return
    const compactQuery = window.matchMedia('(max-width: 900px)')

    const fitName = () => {
      teamName.style.fontSize = ''
      if (!compactQuery.matches) return
      const style = window.getComputedStyle(teamName)
      const naturalSize = Number.parseFloat(style.fontSize)
      const scoreStyle = window.getComputedStyle(score)
      const scoreMargin = Number.parseFloat(scoreStyle.marginLeft) || 0
      const availableWidth = heading.clientWidth - score.offsetWidth - scoreMargin
      const context = document.createElement('canvas').getContext('2d')
      if (!context || !availableWidth) return
      context.font = `${style.fontWeight} ${naturalSize}px ${style.fontFamily}`
      const textWidth = context.measureText(team.clubName).width
      if (textWidth > availableWidth) teamName.style.fontSize = `${Math.max(16, naturalSize * availableWidth / textWidth)}px`
    }

    const observer = new ResizeObserver(fitName)
    observer.observe(heading)
    observer.observe(score)
    compactQuery.addEventListener('change', fitName)
    fitName()
    return () => {
      observer.disconnect()
      compactQuery.removeEventListener('change', fitName)
    }
  }, [scoreRef, team.clubName, totalHeadingRef, totalTeamNameRef])
  return <main className={`broadcast-shell matchday-page total-points-broadcast ${revealingMatch ? 'revealing-match' : ''}`}>
    {transitioningToMatch && <div className="scene-wipe-overlay" aria-hidden="true" />}
    {revealingMatch && (showingLiveLeaderboard
      ? <LeaderboardReveal layout={leaderboardRevealLayout} headingRef={leaderboardHeadingRef} label="Live standings" />
      : <TotalPointsReveal layout={revealLayout} team={team} teamNameRef={totalTeamNameRef} scoreRef={scoreRef} />)}
    <button className="floating-back" type="button" onClick={onBack}><ArrowLeft size={18} />Back</button>
    <div className="live-indicator"><Radio size={16} /><span>Live</span></div>
	    <NarrationCaption id={latestCommentaryId} text={latestCommentaryText} status={latestCommentaryStatus} />
    <ClubSelector teams={displayLiveState.teams} latestEvent={latestEvent} selectedFocus={broadcastFocus} onSelect={onSelectFocus} />
    {showingLiveLeaderboard
      ? <TotalPointsLeaderboard standings={standings} headingRef={leaderboardHeadingRef} />
      : <section className="matchday-stage total-points-stage" aria-label="Focused total-points club broadcast">
      <section className="broadcast-team-column left total-points-team-column" style={{ '--team-color': team.color } as CSSProperties}>
        <div className="broadcast-team-heading"><span>{teamShortName(team)}</span><h2 ref={totalHeadingRef}><span ref={totalTeamNameRef} className="total-team-name">{team.clubName}</span><strong ref={scoreRef} className="total-team-score">{team.score}<span className="total-score-unit">pts</span></strong></h2><p>{team.displayName}</p><strong className="leader-placeholder">Leading</strong></div>
        <TotalPointsPlayerRows team={team} shirtCodes={shirtCodes} latestEvents={latestEvents} pendingEvents={pendingEvents} />
      </section>
      <LiveStandings standings={standings} focusedTeam={team} />
    </section>}
  </main>
}

function TotalPointsLeaderboard({ standings, headingRef }: { standings: LiveStandingView[]; headingRef: RefObject<HTMLHeadingElement | null> }) {
  return <section className="live-leaderboard-page" aria-label="Live standings"><LiveStandings standings={standings} headingRef={headingRef} label="Live standings" /></section>
}

function ClubSelector({ teams, latestEvent, selectedFocus, onSelect }: { teams: TeamView[]; latestEvent?: FantasyEventView; selectedFocus: BroadcastFocus; onSelect: (focus: BroadcastFocus) => void }) {
  return <nav className="match-selector club-selector" aria-label="Ongoing club selector">
    <button className={`match-selector-chip multiview-chip ${selectedFocus === 'multi' ? 'selected-match-chip' : ''}`} type="button" onClick={() => onSelect('multi')}><Radio size={14} /><span>Multi</span></button>
    <div className="match-chip-track">{teams.map((team) => {
      const changed = latestEvent?.managerId === team.managerId
      return <button key={team.managerId} className={`match-selector-chip club-selector-chip ${selectedFocus === team.managerId ? 'selected-match-chip' : ''} ${changed ? 'match-chip-event' : ''}`} type="button" onClick={() => onSelect(team.managerId)}><span className="match-chip-team">{teamShortName(team)}</span><MatchChipScore changed={Boolean(changed)} delta={changed ? latestEvent?.pointDelta ?? 0 : 0} eventId={changed ? latestEvent?.id : undefined} score={team.score} side="right" /></button>
    })}</div>
  </nav>
}

function TotalPointsPlayerRows({ team, shirtCodes, latestEvents, pendingEvents }: { team: TeamView; shirtCodes: ShirtCodes; latestEvents: FantasyEventView[]; pendingEvents: FantasyEventView[] }) {
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
    observer.observe(element); update()
    return () => observer.disconnect()
  }, [])
  const notificationShifts = totalNotificationShifts(rows, team.managerId, latestEvents, width)
  return <section ref={rowsRef} className="total-player-rows" aria-label={`${team.clubName} players`}>{rows.map(([key, label, players]) => players.length > 0 && <section className="total-player-row" key={key}><span>{label}</span><div>{players.map((player, index) => {
    const events = latestEvents.filter((event) => event.managerId === team.managerId && event.playerId === player.id)
    const pendingPointDelta = latestEvents.length === 0 ? pendingEvents.filter((event) => event.managerId === team.managerId && event.playerId === player.id).reduce((total, event) => total + event.pointDelta, 0) : 0
    return <PitchPlayer key={player.id} player={player} side="home" teamColor={team.color} position={totalRowPlayerPosition(index, players.length, width)} shirtCode={shirtCodeFor(player.premierLeagueClub, shirtCodes)} events={events} pendingPointDelta={pendingPointDelta} notificationShift={notificationShifts.get(player.id) ?? 0} />
  })}</div></section>)}</section>
}

function LiveStandings({ standings, focusedTeam, headingRef, label = 'Live standings', showUnsignedLivePoints = false }: { standings: LiveStandingView[]; focusedTeam?: TeamView; headingRef?: RefObject<HTMLHeadingElement | null>; label?: string; showUnsignedLivePoints?: boolean }) {
  const rowElements = useRef(new Map<string, HTMLLIElement>())
  const previousRowTops = useRef(new Map<string, number>())
  useLayoutEffect(() => {
    const nextRowTops = new Map<string, number>()
    rowElements.current.forEach((element, teamId) => {
      const top = element.getBoundingClientRect().top
      const previousTop = previousRowTops.current.get(teamId)
      if (previousTop !== undefined && previousTop !== top) {
        element.animate([{ transform: `translateY(${previousTop - top}px)` }, { transform: 'translateY(0)' }], { duration: 560, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })
      }
      nextRowTops.set(teamId, top)
    })
    previousRowTops.current = nextRowTops
  }, [standings])
  return <aside className={`live-standings ${showUnsignedLivePoints ? 'h2h-live-standings' : ''}`} aria-label={label}><header><strong ref={headingRef}>{label}</strong></header><ol>{standings.slice(0, 12).map((standing) => <li ref={(element) => { if (element) rowElements.current.set(standing.teamId, element); else rowElements.current.delete(standing.teamId) }} key={standing.teamId} className={standing.teamId === focusedTeam?.managerId ? 'focused-standing' : ''}><b>{standing.position}</b><div><strong>{standing.teamName}</strong><span>{standing.managerName}</span></div>{!showUnsignedLivePoints && <StandingValue className="standing-gameweek-points" value={standing.gameweekPoints} signed />}<StandingValue className="standing-total-points" value={standing.total} /></li>)}</ol></aside>
}

function StandingValue({ value, signed = false, className }: { value: number; signed?: boolean; className: string }) {
  const [displayValue, setDisplayValue] = useState(value)
  const previousValue = useRef(value)
  useEffect(() => {
    if (previousValue.current === value) return
    const startValue = previousValue.current
    previousValue.current = value
    setDisplayValue(startValue)
    let interval: number | undefined
    const delay = window.setTimeout(() => {
      const difference = value - startValue
      const direction = difference > 0 ? 1 : -1
      interval = window.setInterval(() => setDisplayValue((current) => {
        const next = current + direction
        if ((direction > 0 && next >= value) || (direction < 0 && next <= value)) {
          if (interval) window.clearInterval(interval)
          return value
        }
        return next
      }), Math.max(70, Math.round(360 / Math.max(1, Math.abs(difference)))))
    }, 240)
    return () => { window.clearTimeout(delay); if (interval) window.clearInterval(interval) }
  }, [value])
  const text = `${signed && displayValue >= 0 ? '+' : ''}${displayValue}`
  return className === 'standing-total-points' ? <em className={className}>{text}</em> : <small className={className}>{text}</small>
}

function TotalPointsReveal({ layout, team, teamNameRef, scoreRef }: { layout: RevealLayout | null; team: TeamView; teamNameRef: RefObject<HTMLSpanElement | null>; scoreRef: RefObject<HTMLElement | null> }) {
	if (!layout) return null
	const compactTransition = window.matchMedia('(max-width: 900px)').matches
	return <div className="match-reveal-overlay total-points-reveal" aria-hidden="true"><div className="match-reveal-sheet" />{compactTransition
		? <><TotalPointsRevealTeamCopy layout={layout.home} scoreLayout={layout.score} name={team.clubName} teamNameRef={teamNameRef} /><TotalScoreRevealCopy layout={layout.score} score={team.score} scoreRef={scoreRef} /></>
		: <><DesktopTotalPointsRevealTeamCopy layout={layout.home} scoreLayout={layout.score} name={team.clubName} teamNameRef={teamNameRef} /><DesktopTotalScoreRevealCopy layout={layout.score} score={team.score} scoreRef={scoreRef} /><DesktopTotalScoreUnitRevealCopy layout={layout.score} scoreRef={scoreRef} /></>}</div>
}

function rangeRect(element: HTMLElement) {
  const range = document.createRange()
  range.selectNodeContents(element)
  return range.getBoundingClientRect()
}

function exactRevealTypography(style: CSSStyleDeclaration): CSSProperties {
  return {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    fontStretch: style.fontStretch,
    fontVariant: style.fontVariant,
    fontKerning: style.fontKerning as CSSProperties['fontKerning'],
    fontSynthesis: style.fontSynthesis as CSSProperties['fontSynthesis'],
    fontOpticalSizing: style.fontOpticalSizing as CSSProperties['fontOpticalSizing'],
    fontFeatureSettings: style.fontFeatureSettings,
    fontVariationSettings: style.fontVariationSettings,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    wordSpacing: style.wordSpacing,
    textTransform: style.textTransform,
    textShadow: style.textShadow,
    textRendering: style.textRendering as CSSProperties['textRendering'],
  }
}

function desktopRevealAppearance(style: CSSStyleDeclaration): CSSProperties {
  return {
    ...exactRevealTypography(style),
    color: style.color,
    display: style.display,
    boxSizing: style.boxSizing as CSSProperties['boxSizing'],
    margin: style.margin,
    padding: style.padding,
    textAlign: style.textAlign as CSSProperties['textAlign'],
    verticalAlign: style.verticalAlign,
    whiteSpace: style.whiteSpace,
  }
}

function preserveRevealStart(layout: RevealRect, offsetX: number, offsetY: number): RevealRect {
  return {
    ...layout,
    left: layout.left + offsetX,
    top: layout.top + offsetY,
    revealX: layout.revealX - offsetX,
    revealY: layout.revealY - offsetY,
  }
}

function DesktopTotalPointsRevealTeamCopy({ layout, scoreLayout, name, teamNameRef }: { layout: RevealLayout['home']; scoreLayout: RevealLayout['score']; name: string; teamNameRef: RefObject<HTMLSpanElement | null> }) {
  const measurementRef = useRef<HTMLElement>(null)
  const [typography, setTypography] = useState<CSSProperties>()
  const [revealScale, setRevealScale] = useState(1)
  const [adjustedLayout, setAdjustedLayout] = useState<RevealLayout['home'] | null>(null)
  useLayoutEffect(() => {
    const teamName = teamNameRef.current
    if (!teamName) return
    const style = window.getComputedStyle(teamName)
    setTypography(desktopRevealAppearance(style))
    const context = document.createElement('canvas').getContext('2d')
    if (!context) return
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    const textWidth = context.measureText(name).width
    const scoreHalfWidth = scoreLayout.width * 1.08 / 2
    const teamStartCentre = layout.left + layout.width / 2 + layout.revealX
    const availableWidth = window.innerWidth / 2 - scoreHalfWidth - REVEAL_SCORE_CLEARANCE_PX - (teamStartCentre - layout.width / 2)
    setRevealScale(Math.min(1, Math.max(0.24, availableWidth / Math.max(1, textWidth))))
    setAdjustedLayout(null)
  }, [layout, name, scoreLayout.width, teamNameRef])
  useLayoutEffect(() => {
    const teamName = teamNameRef.current
    const measurement = measurementRef.current
    if (!typography || !teamName || !measurement) return
    const target = rangeRect(teamName)
    const copy = rangeRect(measurement)
    setAdjustedLayout(preserveRevealStart(layout, target.left - copy.left, target.top - copy.top))
  }, [layout, teamNameRef, typography])
  const copyStyle: CSSProperties | undefined = typography ? { ...revealCopyStyle(layout, 1), ...typography, animation: 'none', transform: 'none', visibility: 'hidden' } : undefined
  return <><span ref={measurementRef} className="match-reveal-copy match-reveal-team reveal-home total-team-name desktop-total-reveal-copy" style={copyStyle}>{name}</span>{adjustedLayout && <span className="match-reveal-copy match-reveal-team reveal-home total-team-name desktop-total-reveal-copy" style={{ ...revealCopyStyle(adjustedLayout, revealScale * TOTAL_POINTS_REVEAL_TEAM_SCALE), ...typography }}>{name}</span>}</>
}

function DesktopTotalScoreRevealCopy({ layout, score, scoreRef }: { layout: RevealLayout['score']; score: number; scoreRef: RefObject<HTMLElement | null> }) {
  const measurementRef = useRef<HTMLElement>(null)
  const [typography, setTypography] = useState<CSSProperties>()
  const [adjustedLayout, setAdjustedLayout] = useState<RevealLayout['score'] | null>(null)
  useLayoutEffect(() => {
    const scoreElement = scoreRef.current
    if (!scoreElement) return
    const style = window.getComputedStyle(scoreElement)
    setTypography(desktopRevealAppearance(style))
    setAdjustedLayout(null)
  }, [layout, scoreRef])
  useLayoutEffect(() => {
    const scoreElement = scoreRef.current
    const measurement = measurementRef.current
    if (!typography || !scoreElement || !measurement) return
    const target = rangeRect(scoreElement)
    const copy = rangeRect(measurement)
    setAdjustedLayout(preserveRevealStart(layout, target.left - copy.left, target.top - copy.top))
  }, [layout, scoreRef, typography])
  const copyStyle: CSSProperties | undefined = typography ? { ...revealCopyStyle(layout, 1), ...typography, animation: 'none', transform: 'none', visibility: 'hidden' } : undefined
  return <><strong ref={measurementRef} className="match-reveal-copy total-reveal-score total-team-score desktop-total-reveal-copy" style={copyStyle}>{score}<span className="total-score-unit">pts</span></strong>{adjustedLayout && <strong className="match-reveal-copy total-reveal-score total-team-score desktop-total-reveal-copy" style={{ ...revealCopyStyle(adjustedLayout, 1), ...typography }}>{score}<span className="total-score-unit">pts</span></strong>}</>
}

function DesktopTotalScoreUnitRevealCopy({ layout, scoreRef }: { layout: RevealLayout['score']; scoreRef: RefObject<HTMLElement | null> }) {
  const [unitLayout, setUnitLayout] = useState<RevealLayout['score'] | null>(null)
  const [appearance, setAppearance] = useState<CSSProperties>()
  useLayoutEffect(() => {
    const scoreElement = scoreRef.current
    const unit = scoreElement?.querySelector<HTMLElement>('.total-score-unit')
    if (!unit) return
    const target = rangeRect(unit)
    setAppearance({ ...exactRevealTypography(window.getComputedStyle(unit)), marginLeft: 0 })
    setUnitLayout({
      left: target.left,
      top: target.top,
      width: target.width,
      height: target.height,
      revealX: layout.revealX,
      revealY: layout.revealY,
    })
  }, [layout, scoreRef])
  if (!unitLayout) return null
  return <span className="match-reveal-copy total-score-unit desktop-total-reveal-copy" style={{ ...revealCopyStyle(unitLayout, 1), ...appearance }}>pts</span>
}

function TotalPointsRevealTeamCopy({ layout, scoreLayout, name, teamNameRef }: { layout: RevealLayout['home']; scoreLayout: RevealLayout['score']; name: string; teamNameRef: RefObject<HTMLSpanElement | null> }) {
  const measurementRef = useRef<HTMLElement>(null)
  const [typography, setTypography] = useState<CSSProperties>()
  const [revealScale, setRevealScale] = useState(1)
  const [adjustedLayout, setAdjustedLayout] = useState<RevealLayout['home'] | null>(null)

  useLayoutEffect(() => {
    const teamName = teamNameRef.current
    if (!teamName) return
    const style = window.getComputedStyle(teamName)
    setTypography(exactRevealTypography(style))
    const context = document.createElement('canvas').getContext('2d')
    if (!context) return
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    const textWidth = context.measureText(name).width
    const compactTransition = window.matchMedia('(max-width: 900px)').matches
    const scoreHalfWidth = scoreLayout.width * 1.08 / 2
    const teamStartCentre = layout.left + layout.width / 2 + layout.revealX
    const availableWidth = window.innerWidth / 2 - scoreHalfWidth - REVEAL_SCORE_CLEARANCE_PX - (teamStartCentre - layout.width / 2)
    const sourceScale = compactTransition
      ? Math.min(TOTAL_POINTS_REVEAL_TEAM_SCALE, Math.max(0.1, (window.innerWidth * 0.9 * 0.75 - 10) / Math.max(1, textWidth)))
      : Math.min(1, Math.max(0.24, availableWidth / Math.max(1, textWidth))) * TOTAL_POINTS_REVEAL_TEAM_SCALE
    setRevealScale(sourceScale / TOTAL_POINTS_REVEAL_TEAM_SCALE)
    setAdjustedLayout(null)
  }, [layout, name, scoreLayout.width, teamNameRef])

  useLayoutEffect(() => {
    const teamName = teamNameRef.current
    const measurement = measurementRef.current
    if (!typography || !teamName || !measurement) return
    const target = rangeRect(teamName)
    const copy = rangeRect(measurement)
    const offsetX = target.left - copy.left
    const offsetY = target.top - copy.top
    setAdjustedLayout(preserveRevealStart(layout, offsetX, offsetY))
  }, [layout, teamNameRef, typography])

  const copyStyle: CSSProperties | undefined = typography ? { ...revealCopyStyle(layout, 1), ...typography, animation: 'none', transform: 'none', visibility: 'hidden' } : undefined
  return <><span ref={measurementRef} className="match-reveal-copy match-reveal-team reveal-home total-team-name" style={copyStyle}>{name}</span>{adjustedLayout && <span className="match-reveal-copy match-reveal-team reveal-home total-team-name" style={{ ...revealCopyStyle(adjustedLayout, revealScale * TOTAL_POINTS_REVEAL_TEAM_SCALE), ...typography }}>{name}</span>}</>
}

function TotalScoreRevealCopy({ layout, score, scoreRef }: { layout: RevealLayout['score']; score: number; scoreRef: RefObject<HTMLElement | null> }) {
  const measurementRef = useRef<HTMLElement>(null)
  const [typography, setTypography] = useState<CSSProperties>()
  const [adjustedLayout, setAdjustedLayout] = useState<RevealLayout['score'] | null>(null)
  const [sourceScale, setSourceScale] = useState(1)
  useLayoutEffect(() => {
    const scoreElement = scoreRef.current
    if (!scoreElement) return
    const style = window.getComputedStyle(scoreElement)
    setTypography(exactRevealTypography(style))
    setAdjustedLayout(null)
    const compactTransition = window.matchMedia('(max-width: 900px)').matches
    const scoreBoxWidth = window.innerWidth * 0.9 * 0.25
    setSourceScale(compactTransition ? Math.min(1, Math.max(0.1, (scoreBoxWidth - 10) / Math.max(1, layout.width))) : 1)
  }, [layout, scoreRef])
  useLayoutEffect(() => {
    const scoreElement = scoreRef.current
    const measurement = measurementRef.current
    if (!typography || !scoreElement || !measurement) return
    const target = rangeRect(scoreElement)
    const copy = rangeRect(measurement)
    setAdjustedLayout(preserveRevealStart(layout, target.left - copy.left, target.top - copy.top))
  }, [layout, scoreRef, typography])

  const copyStyle: CSSProperties | undefined = typography
    ? { ...revealCopyStyle(layout, 1), ...typography, animation: 'none', transform: 'none', visibility: 'hidden' }
    : undefined
  return <><strong ref={measurementRef} className="match-reveal-copy total-reveal-score total-team-score" style={copyStyle}>{score}<span className="total-score-unit">pts</span></strong>{adjustedLayout && <strong className="match-reveal-copy total-reveal-score total-team-score" style={{ ...revealCopyStyle(adjustedLayout, sourceScale), ...typography }}>{score}<span className="total-score-unit">pts</span></strong>}</>
}

function totalRowPlayerPosition(index: number, count: number, rowWidth: number) {
  if (count <= 1) return { x: 50, y: 50, yOffset: 0 }
  if (!rowWidth) return { x: 50, y: 50, yOffset: 0 }
  const compactCards = window.matchMedia('(max-width: 900px)').matches
  const cardWidth = compactCards ? 70 : 110
  const adjacentDistance = cardWidth + window.innerWidth * 0.01
  const offsetFromCentre = index - (count - 1) / 2
  return { x: 50 + offsetFromCentre * adjacentDistance / rowWidth * 100, y: 50, yOffset: 0 }
}

function totalNotificationShifts(rows: ReadonlyArray<readonly [string, string, PlayerView[]]>, managerId: string, latestEvents: FantasyEventView[], width: number) {
  if (!width) return new Map<string, number>()
  const notifiedPlayers = rows.flatMap(([, , players], rowIndex) => players.map((player, index) => {
    const events = latestEvents.filter((event) => event.managerId === managerId && event.playerId === player.id)
    return { id: player.id, hasEvent: events.length > 0, width: Math.max(108, ...events.map(notificationWidthFor)), x: totalRowPlayerPosition(index, players.length, width).x * width / 100, y: rowIndex * 70 }
  }).filter((player) => player.hasEvent))
  return notificationShiftsForPlayers(notifiedPlayers)
}

function displayPlayerPoints(player: PlayerView, points: number) {
  return points === 0 && (player.minutes ?? 0) === 0 ? '–' : points
}

function notificationShiftsFor(matchup: MatchupView, latestEvents: FantasyEventView[], pitchSize: { width: number; height: number }) {
  if (!pitchSize.width || !pitchSize.height) return new Map<string, number>()
  const notifiedPlayers = ([['home', matchup.home], ['away', matchup.away]] as const).flatMap(([side, team]) =>
    team.activePlayers.map((player) => {
      const events = latestEvents.filter((event) => event.managerId === team.managerId && event.playerId === player.id)
      const position = formationPosition(team.activePlayers, player, side)
      const width = Math.max(108, ...events.map(notificationWidthFor))
      return { id: player.id, hasEvent: events.length > 0, width, x: position.x * pitchSize.width / 100, y: position.y * pitchSize.height / 100 + position.yOffset }
    }).filter((player) => player.hasEvent))

  return notificationShiftsForPlayers(notifiedPlayers)
}

function notificationShiftsForPlayers(notifiedPlayers: Array<{ id: string; width: number; x: number; y: number }>) {
  const shifts = new Map<string, number>()
  for (let firstIndex = 0; firstIndex < notifiedPlayers.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < notifiedPlayers.length; secondIndex += 1) {
      const first = notifiedPlayers[firstIndex]
      const second = notifiedPlayers[secondIndex]
      // A notification sits below its player metadata, so rows that are slightly offset can
      // still collide with a neighbouring player's label (not just perfectly aligned rows).
      if (Math.abs(first.y - second.y) > 64) continue
      const left = first.x <= second.x ? first : second
      const right = first.x <= second.x ? second : first
      const overlap = (left.width + right.width) / 2 + 8 - (right.x - left.x)
      if (overlap <= 0) continue
      shifts.set(left.id, (shifts.get(left.id) ?? 0) - overlap / 2)
      shifts.set(right.id, (shifts.get(right.id) ?? 0) + overlap / 2)
    }
  }
  return shifts
}

function notificationWidthFor(candidate: FantasyEventView) {
  return Math.ceil(candidate.type.replaceAll('_', ' ').length * 8 + `${candidate.pointDelta > 0 ? '+' : ''}${candidate.pointDelta} pts`.length * 7.5 + 36)
}

function PitchMarkings() { return <><span className="pitch-halfway" /><span className="pitch-centre-circle" /><span className="pitch-centre-spot" /><span className="pitch-area left-area" /><span className="pitch-area right-area" /></> }

function formationPosition(players: PlayerView[], player: PlayerView, side: 'home' | 'away') {
  const samePosition = players.filter((candidate) => candidate.position === player.position)
  const rowIndex = Math.max(0, samePosition.findIndex((candidate) => candidate.id === player.id))
  const homeColumn = player.position === 'GKP' ? 0 : player.position === 'DEF' ? 1 : player.position === 'MID' ? 2 : 3
  const homeX = 6.25 + homeColumn * 12.5
  const x = side === 'home' ? homeX : 100 - homeX
  const verticalPosition = playerVerticalPosition(rowIndex, samePosition.length)
  return { x, ...verticalPosition }
}

function playerVerticalPosition(index: number, count: number) {
  const distanceFromCentre = index - (count - 1) / 2
  const y = 50 + distanceFromCentre * 16
  const yOffset = distanceFromCentre * 30
  return { y: Number.isFinite(y) ? y : 50, yOffset: Number.isFinite(yOffset) ? yOffset : index * 30 }
}
function shirtCodeFor(clubName: string, shirtCodes: ShirtCodes) {
  const requestedName = normalizeClubName(clubName)
  const exactMatch = shirtCodes.find((team) => [team.name, team.shortName].some((name) => normalizeClubName(name) === requestedName))
  if (exactMatch) return exactMatch.code

  const match = shirtCodes
    .map((team) => ({
      team,
      score: Math.max(
        clubNameSimilarity(requestedName, normalizeClubName(team.name)),
        clubShortNameSimilarity(requestedName, normalizeClubName(team.shortName)),
      ),
    }))
    .filter((candidate) => candidate.score >= 50)
    .sort((left, right) => right.score - left.score)[0]
  return match?.team.code
}
function normalizeClubName(name: string | undefined) { return (name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() }
function clubNameSimilarity(firstName: string, secondName: string) {
  if (!firstName || !secondName) return 0
  if (firstName.includes(secondName) || secondName.includes(firstName)) return 100
  const firstWords = firstName.split(' ')
  const secondWords = secondName.split(' ')
  const sharedWords = firstWords.filter((word) => secondWords.includes(word)).length
  const firstWordMatches = abbreviatedWordMatches(firstWords[0], secondWords[0])
  const lastWordMatches = abbreviatedWordMatches(firstWords.at(-1), secondWords.at(-1))
  return sharedWords * 30 + (firstWordMatches ? 25 : 0) + (lastWordMatches ? 25 : 0)
}
function clubShortNameSimilarity(clubName: string, shortName: string) {
  if (!clubName || !shortName) return 0
  return clubName.split(' ').some((word) => word.startsWith(shortName) || shortName.startsWith(word)) ? 70 : 0
}
function abbreviatedWordMatches(firstWord: string | undefined, secondWord: string | undefined) {
  if (!firstWord || !secondWord) return false
  return firstWord.startsWith(secondWord) || secondWord.startsWith(firstWord) || firstWord.slice(0, 3) === secondWord.slice(0, 3) || (firstWord[0] === secondWord[0] && firstWord.at(-1) === secondWord.at(-1))
}

function MatchReveal({ layout, matchup, homeHeadingRef, awayHeadingRef, scoreRef }: { layout: RevealLayout | null; matchup: MatchupView; homeHeadingRef: RefObject<HTMLHeadingElement | null>; awayHeadingRef: RefObject<HTMLHeadingElement | null>; scoreRef: RefObject<HTMLElement | null> }) {
  const viewportWidth = layout?.viewportWidth ?? window.innerWidth
  return <div className="match-reveal-overlay" aria-hidden="true"><div className="match-reveal-sheet" />{layout && <><RevealTeamCopy className="reveal-home" layout={layout.home} scoreLayout={layout.score} viewportWidth={viewportWidth} name={matchup.home.clubName} headingRef={homeHeadingRef} /><RevealScoreCopy layout={layout.score} score={formatScoreline(matchup.scoreline)} scoreRef={scoreRef} /><RevealTeamCopy className="reveal-away" layout={layout.away} scoreLayout={layout.score} viewportWidth={viewportWidth} name={matchup.away.clubName} headingRef={awayHeadingRef} /></>}</div>
}

function RevealScoreCopy({ layout, score, scoreRef }: { layout: RevealLayout['score']; score: string; scoreRef: RefObject<HTMLElement | null> }) {
  const [typography, setTypography] = useState<CSSProperties>()
  useLayoutEffect(() => {
    const scoreElement = scoreRef.current
    if (!scoreElement) return
    const style = window.getComputedStyle(scoreElement)
    setTypography({ fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight, fontStyle: style.fontStyle, lineHeight: style.lineHeight, letterSpacing: style.letterSpacing, textTransform: style.textTransform, textShadow: style.textShadow })
  }, [scoreRef, layout])
  return <strong className="match-reveal-copy match-reveal-score" style={{ ...revealCopyStyle(layout, 1.08), ...typography }}>{score}</strong>
}

function RevealTeamCopy({ className, layout, scoreLayout, viewportWidth, name, headingRef, initialScaleMultiplier = 1 }: { className: string; layout: RevealLayout['home']; scoreLayout: RevealLayout['score']; viewportWidth: number; name: string; headingRef: RefObject<HTMLElement | null>; initialScaleMultiplier?: number }) {
  const [revealScale, setRevealScale] = useState(1)
  const [typography, setTypography] = useState<CSSProperties>()
  const [sourceFontSize, setSourceFontSize] = useState<number>()
  useLayoutEffect(() => {
    const heading = headingRef.current
    if (!heading) return
    const style = window.getComputedStyle(heading)
	setTypography({ fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight, lineHeight: style.lineHeight, letterSpacing: style.letterSpacing, textTransform: style.textTransform })
    const context = document.createElement('canvas').getContext('2d')
    if (!context) return
    const naturalSize = Number.parseFloat(style.fontSize)
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    const textWidth = context.measureText(name).width
    setSourceFontSize(naturalSize * (viewportWidth * 0.8) / Math.max(1, textWidth))
    const scoreHalfWidth = scoreLayout.width * 1.08 / 2
    const scoreCentre = viewportWidth / 2
    const revealGap = viewportWidth * 0.05
    const availableWidth = className === 'reveal-home'
      ? scoreCentre - scoreHalfWidth - revealGap - viewportWidth * 0.05
      : viewportWidth - viewportWidth * 0.05 - scoreCentre - scoreHalfWidth - revealGap
    setRevealScale(Math.min(1, Math.max(0.24, availableWidth / Math.max(1, textWidth))))
  }, [className, headingRef, name, scoreLayout.width, viewportWidth])
  const revealCopyScale = revealScale * initialScaleMultiplier
  const scoreHalfWidth = scoreLayout.width * 1.08 / 2
  const revealGap = viewportWidth * 0.05
  const finalCentre = layout.left + layout.width / 2
  const initialCentre = className === 'reveal-home'
    ? viewportWidth / 2 - scoreHalfWidth - revealGap - layout.width * revealCopyScale / 2
    : viewportWidth / 2 + scoreHalfWidth + revealGap + layout.width * revealCopyScale / 2
	return <strong className={`match-reveal-copy match-reveal-team ${className}`} style={{ ...revealCopyStyle(layout, revealCopyScale), ...typography, '--reveal-x': `${initialCentre - finalCentre}px`, '--reveal-box-width': `${layout.width}px`, '--reveal-source-font-size': `${sourceFontSize ?? 0}px`, '--reveal-final-font-size': typography?.fontSize ?? 'inherit' } as CSSProperties}><span>{name}</span></strong>
}
