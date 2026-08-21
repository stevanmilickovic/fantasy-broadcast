import { ArrowLeft, Radio, Trophy } from 'lucide-react'
import type { CSSProperties, RefObject } from 'react'
import { useEffect, useState } from 'react'
import type { BroadcastFocus, FantasyEventView, LiveStateResponse, MatchupView, PlayerView, RevealLayout, TeamView } from '../../types/live'
import { formatScoreline, matchupHasEvent, playerCardName, revealCopyStyle, teamShortName } from '../../utils/broadcast'

type BroadcastMatchdayProps = {
  displayLiveState: LiveStateResponse
  matchup: MatchupView
  latestCommentaryText: string
  latestCommentaryStatus: string
  leaderName: string
  broadcastFocus: BroadcastFocus
  revealingMatch: boolean
  revealLayout: RevealLayout | null
  transitioningToMatch: boolean
  visibleEventId: string | null
  homeHeadingRef: RefObject<HTMLHeadingElement | null>
  awayHeadingRef: RefObject<HTMLHeadingElement | null>
  scoreRef: RefObject<HTMLElement | null>
  onBack: () => void
  onSelectFocus: (focus: BroadcastFocus) => void
}

type FplClubShirt = { name: string; shortName?: string; code: number }
type ShirtCodes = FplClubShirt[]

export function BroadcastMatchday({
  displayLiveState, matchup, leaderName, broadcastFocus,
  revealingMatch, revealLayout, transitioningToMatch, visibleEventId, homeHeadingRef, awayHeadingRef, scoreRef,
  onBack, onSelectFocus,
}: BroadcastMatchdayProps) {
  const displayLatestEvent = displayLiveState.events[0]
  const displayEvent = matchupHasEvent(matchup, displayLatestEvent) && visibleEventId === displayLatestEvent?.id ? displayLatestEvent : undefined
  return (
    <main className={`broadcast-shell matchday-page ${revealingMatch ? 'revealing-match' : ''}`}>
      {transitioningToMatch && <div className="scene-wipe-overlay" aria-hidden="true" />}
      {revealingMatch && <MatchReveal layout={revealLayout} matchup={matchup} />}
      <button className="floating-back" type="button" onClick={onBack}><ArrowLeft size={18} />Back</button>
      <div className="live-indicator"><Radio size={16} /><span>Live</span></div>
      <MatchSelector latestEvent={displayLatestEvent} matchups={displayLiveState.matchups} selectedFocus={broadcastFocus} onSelect={onSelectFocus} />

      <section className="matchday-stage pitch-broadcast-stage" aria-label="Focused matchup broadcast">
        <BroadcastTeamColumn side="left" team={matchup.home} isLeader={matchup.leaderManagerId === matchup.home.managerId} headingRef={homeHeadingRef} />
        <PitchStage gameweek={displayLiveState.gameweek} scoreline={matchup.scoreline} leaderName={leaderName} scoreRef={scoreRef} matchup={matchup} latestEvent={displayEvent} />
        <BroadcastTeamColumn side="right" team={matchup.away} isLeader={matchup.leaderManagerId === matchup.away.managerId} headingRef={awayHeadingRef} />
      </section>
    </main>
  )
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
  return <section className={`broadcast-team-column ${side}`} style={{ '--team-color': team.color } as CSSProperties}>
    <div className="broadcast-team-heading">
    <span>{teamShortName(team)}</span><h2 ref={headingRef}>{team.clubName}</h2><p>{team.displayName}</p><strong className={isLeader ? '' : 'leader-placeholder'}>Leading</strong>
    </div>
  </section>
}

function PitchStage({ gameweek, scoreline, leaderName, scoreRef, matchup, latestEvent }: { gameweek: number; scoreline: string; leaderName: string; scoreRef: RefObject<HTMLElement | null>; matchup: MatchupView; latestEvent?: FantasyEventView }) {
  const shirtCodes = useShirtCodes()
  return <section className="pitch-panel pitch-panel-live">
    <div className="match-score-strip"><span>GW{gameweek}</span><strong ref={scoreRef}>{formatScoreline(scoreline)}</strong><small><Trophy size={14} />{leaderName === 'No one' ? 'Level' : leaderName}</small></div>
    <div className="pitch-and-benches">
      <BenchRail side="left" team={matchup.home} shirtCodes={shirtCodes} />
      <LivePitch matchup={matchup} shirtCodes={shirtCodes} latestEvent={latestEvent} />
      <BenchRail side="right" team={matchup.away} shirtCodes={shirtCodes} />
    </div>
  </section>
}

function LivePitch({ matchup, shirtCodes, latestEvent }: { matchup: MatchupView; shirtCodes: ShirtCodes; latestEvent?: FantasyEventView }) {
  return <section className="live-pitch" aria-label="Live fantasy football pitch">
    <PitchMarkings />
    <PitchTeam side="home" team={matchup.home} shirtCodes={shirtCodes} latestEvent={latestEvent} />
    <PitchTeam side="away" team={matchup.away} shirtCodes={shirtCodes} latestEvent={latestEvent} />
  </section>
}

function BenchRail({ side, team, shirtCodes }: { side: 'left' | 'right'; team: TeamView; shirtCodes: ShirtCodes }) {
  return <aside className={`bench-rail ${side}`} aria-label={`${team.clubName} bench`}>
    <span className="bench-rail-title">Bench</span>
    {team.benchPlayers.map((player, index) => {
      const shirtCode = shirtCodeFor(player.premierLeagueClub, shirtCodes)
      const shirtUrl = shirtCode ? `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${shirtCode}-66.png` : undefined
      const name = playerCardName(player).join(' ').trim()
      const verticalPosition = playerVerticalPosition(index, team.benchPlayers.length)
      const style = { '--team-color': team.color, '--y': `${verticalPosition.y}%`, '--y-offset': `${verticalPosition.yOffset}px` } as CSSProperties
      return <div className="bench-player" key={player.id} style={style}>
        <div className="player-token bench-player-token"><div className="player-core"><div className="shirt-wrap">{shirtUrl ? <img src={shirtUrl} alt={`${player.premierLeagueClub} shirt`} /> : <span>{name}</span>}</div><div className="player-meta"><strong>{name}</strong><b>{player.points}</b></div></div></div>
      </div>
    })}
  </aside>
}

function useShirtCodes(): ShirtCodes {
  const [codes, setCodes] = useState<ShirtCodes>([])
  useEffect(() => {
    let alive = true
    fetch('/api/fpl/discovery/shirts')
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
  }, [])
  return codes
}

function PitchTeam({ side, team, shirtCodes, latestEvent }: { side: 'home' | 'away'; team: TeamView; shirtCodes: ShirtCodes; latestEvent?: FantasyEventView }) {
  return <>{team.activePlayers.map((player) => {
    const position = formationPosition(team.activePlayers, player, side)
    const event = latestEvent?.managerId === team.managerId && latestEvent.playerId === player.id ? latestEvent : undefined
    return <PitchPlayer key={player.id} player={player} side={side} teamColor={team.color} position={position} shirtCode={shirtCodeFor(player.premierLeagueClub, shirtCodes)} event={event} />
  })}</>
}

function PitchPlayer({ player, side, teamColor, position, shirtCode, event }: { player: PlayerView; side: 'home' | 'away'; teamColor: string; position: { x: number; y: number; yOffset: number }; shirtCode?: number; event?: FantasyEventView }) {
  const name = playerCardName(player).join(' ').trim()
  const shirtUrl = shirtCode ? `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${shirtCode}-110.png` : undefined
  const style = { '--x': `${position.x}%`, '--y': `${position.y}%`, '--y-offset': `${position.yOffset}px`, '--team-color': teamColor } as CSSProperties
  const [notificationEventId, setNotificationEventId] = useState<string | null>(null)
  const [notificationLeaving, setNotificationLeaving] = useState(false)
  const [displayedPoints, setDisplayedPoints] = useState(player.points)
  const [retainedEvent, setRetainedEvent] = useState<FantasyEventView | undefined>(undefined)
  const activeEvent = event ?? retainedEvent
  const eventLabel = activeEvent?.type.replaceAll('_', ' ') ?? ''
  const eventPoints = activeEvent ? `${activeEvent.pointDelta > 0 ? '+' : ''}${activeEvent.pointDelta} pts` : ''
  // This is based on the actual notification content, not a one-size event card.
  const eventWidth = Math.max(108, Math.ceil(eventLabel.length * 8 + eventPoints.length * 7.5 + 36))
  const metadataWidth = 26 + Math.min(82, Math.max(34, name.length * 6 + 12))
  const eventStyle = { '--event-width': `${eventWidth}px`, '--metadata-width': `${metadataWidth}px` } as CSSProperties
  const pointsToRender = event && notificationEventId !== event.id ? player.points - event.pointDelta : displayedPoints

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
    const startingPoints = player.points - event.pointDelta
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
  }, [event?.id, event?.pointDelta, player.points])

  return <div className={`pitch-player ${side} ${activeEvent ? 'has-event' : ''}`} style={style}>
    <div className={`player-token ${activeEvent ? 'has-event' : ''} ${notificationLeaving ? 'is-leaving' : ''}`}><div className="player-core"><div className="shirt-wrap">{shirtUrl ? <img src={shirtUrl} alt={`${player.premierLeagueClub} shirt`} /> : <span>{name}</span>}</div><div className={`player-event-stack ${activeEvent ? 'has-event' : ''} ${notificationLeaving ? 'is-leaving' : ''}`} style={activeEvent ? eventStyle : undefined}><div className="player-meta"><strong>{name}</strong><b>{pointsToRender}</b></div>{activeEvent && notificationEventId === activeEvent.id && <span className={`player-event-notification ${notificationLeaving ? 'is-leaving' : ''}`}><strong>{eventLabel}</strong><span>{eventPoints}</span></span>}</div></div></div>
  </div>
}

function PitchMarkings() { return <><span className="pitch-halfway" /><span className="pitch-centre-circle" /><span className="pitch-centre-spot" /><span className="pitch-area left-area" /><span className="pitch-area right-area" /><span className="pitch-goal left-goal" /><span className="pitch-goal right-goal" /></> }

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

function MatchReveal({ layout, matchup }: { layout: RevealLayout | null; matchup: MatchupView }) {
  return <div className="match-reveal-overlay" aria-hidden="true"><div className="match-reveal-sheet" />{layout && <><strong className="match-reveal-copy match-reveal-team reveal-home" style={revealCopyStyle(layout.home, 1.08)}>{matchup.home.clubName}</strong><strong className="match-reveal-copy match-reveal-score" style={revealCopyStyle(layout.score, 1.08)}>{formatScoreline(matchup.scoreline)}</strong><strong className="match-reveal-copy match-reveal-team reveal-away" style={revealCopyStyle(layout.away, 1.08)}>{matchup.away.clubName}</strong></>}</div>
}
