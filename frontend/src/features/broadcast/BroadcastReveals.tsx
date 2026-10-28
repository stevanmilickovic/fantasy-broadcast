import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { formatScoreline, revealCopyStyle, TOTAL_POINTS_REVEAL_TEAM_SCALE } from './broadcast'
import type { RevealLayout, RevealRect, TeamView, MatchupView } from './types'

const REVEAL_SCORE_CLEARANCE_PX = 42

export function TotalPointsReveal({
  layout,
  team,
  teamNameRef,
  scoreRef,
}: {
  layout: RevealLayout | null
  team: TeamView
  teamNameRef: RefObject<HTMLSpanElement | null>
  scoreRef: RefObject<HTMLElement | null>
}) {
  if (!layout) return null
  const compactTransition = window.matchMedia('(max-width: 900px)').matches
  return (
    <div className="match-reveal-overlay total-points-reveal" aria-hidden="true">
      <div className="match-reveal-sheet" />
      {compactTransition ? (
        <>
          <TotalPointsRevealTeamCopy
            layout={layout.home}
            scoreLayout={layout.score}
            name={team.clubName}
            teamNameRef={teamNameRef}
          />
          <TotalScoreRevealCopy layout={layout.score} score={team.score} scoreRef={scoreRef} />
        </>
      ) : (
        <>
          <DesktopTotalPointsRevealTeamCopy
            layout={layout.home}
            scoreLayout={layout.score}
            name={team.clubName}
            teamNameRef={teamNameRef}
          />
          <DesktopTotalScoreRevealCopy
            layout={layout.score}
            score={team.score}
            scoreRef={scoreRef}
          />
          <DesktopTotalScoreUnitRevealCopy layout={layout.score} scoreRef={scoreRef} />
        </>
      )}
    </div>
  )
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

function DesktopTotalPointsRevealTeamCopy({
  layout,
  scoreLayout,
  name,
  teamNameRef,
}: {
  layout: RevealLayout['home']
  scoreLayout: RevealLayout['score']
  name: string
  teamNameRef: RefObject<HTMLSpanElement | null>
}) {
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
    const scoreHalfWidth = (scoreLayout.width * 1.08) / 2
    const teamStartCentre = layout.left + layout.width / 2 + layout.revealX
    const availableWidth =
      window.innerWidth / 2 -
      scoreHalfWidth -
      REVEAL_SCORE_CLEARANCE_PX -
      (teamStartCentre - layout.width / 2)
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
  const copyStyle: CSSProperties | undefined = typography
    ? {
        ...revealCopyStyle(layout, 1),
        ...typography,
        animation: 'none',
        transform: 'none',
        visibility: 'hidden',
      }
    : undefined
  return (
    <>
      <span
        ref={measurementRef}
        className="match-reveal-copy match-reveal-team reveal-home total-team-name desktop-total-reveal-copy"
        style={copyStyle}
      >
        {name}
      </span>
      {adjustedLayout && (
        <span
          className="match-reveal-copy match-reveal-team reveal-home total-team-name desktop-total-reveal-copy"
          style={{
            ...revealCopyStyle(adjustedLayout, revealScale * TOTAL_POINTS_REVEAL_TEAM_SCALE),
            ...typography,
          }}
        >
          {name}
        </span>
      )}
    </>
  )
}

function DesktopTotalScoreRevealCopy({
  layout,
  score,
  scoreRef,
}: {
  layout: RevealLayout['score']
  score: number
  scoreRef: RefObject<HTMLElement | null>
}) {
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
  const copyStyle: CSSProperties | undefined = typography
    ? {
        ...revealCopyStyle(layout, 1),
        ...typography,
        animation: 'none',
        transform: 'none',
        visibility: 'hidden',
      }
    : undefined
  return (
    <>
      <strong
        ref={measurementRef}
        className="match-reveal-copy total-reveal-score total-team-score desktop-total-reveal-copy"
        style={copyStyle}
      >
        {score}
        <span className="total-score-unit">pts</span>
      </strong>
      {adjustedLayout && (
        <strong
          className="match-reveal-copy total-reveal-score total-team-score desktop-total-reveal-copy"
          style={{ ...revealCopyStyle(adjustedLayout, 1), ...typography }}
        >
          {score}
          <span className="total-score-unit">pts</span>
        </strong>
      )}
    </>
  )
}

function DesktopTotalScoreUnitRevealCopy({
  layout,
  scoreRef,
}: {
  layout: RevealLayout['score']
  scoreRef: RefObject<HTMLElement | null>
}) {
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
  return (
    <span
      className="match-reveal-copy total-score-unit desktop-total-reveal-copy"
      style={{ ...revealCopyStyle(unitLayout, 1), ...appearance }}
    >
      pts
    </span>
  )
}

function TotalPointsRevealTeamCopy({
  layout,
  scoreLayout,
  name,
  teamNameRef,
}: {
  layout: RevealLayout['home']
  scoreLayout: RevealLayout['score']
  name: string
  teamNameRef: RefObject<HTMLSpanElement | null>
}) {
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
    const scoreHalfWidth = (scoreLayout.width * 1.08) / 2
    const teamStartCentre = layout.left + layout.width / 2 + layout.revealX
    const availableWidth =
      window.innerWidth / 2 -
      scoreHalfWidth -
      REVEAL_SCORE_CLEARANCE_PX -
      (teamStartCentre - layout.width / 2)
    const sourceScale = compactTransition
      ? Math.min(
          TOTAL_POINTS_REVEAL_TEAM_SCALE,
          Math.max(0.1, (window.innerWidth * 0.9 * 0.75 - 10) / Math.max(1, textWidth)),
        )
      : Math.min(1, Math.max(0.24, availableWidth / Math.max(1, textWidth))) *
        TOTAL_POINTS_REVEAL_TEAM_SCALE
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

  const copyStyle: CSSProperties | undefined = typography
    ? {
        ...revealCopyStyle(layout, 1),
        ...typography,
        animation: 'none',
        transform: 'none',
        visibility: 'hidden',
      }
    : undefined
  return (
    <>
      <span
        ref={measurementRef}
        className="match-reveal-copy match-reveal-team reveal-home total-team-name"
        style={copyStyle}
      >
        {name}
      </span>
      {adjustedLayout && (
        <span
          className="match-reveal-copy match-reveal-team reveal-home total-team-name"
          style={{
            ...revealCopyStyle(adjustedLayout, revealScale * TOTAL_POINTS_REVEAL_TEAM_SCALE),
            ...typography,
          }}
        >
          {name}
        </span>
      )}
    </>
  )
}

function TotalScoreRevealCopy({
  layout,
  score,
  scoreRef,
}: {
  layout: RevealLayout['score']
  score: number
  scoreRef: RefObject<HTMLElement | null>
}) {
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
    setSourceScale(
      compactTransition
        ? Math.min(1, Math.max(0.1, (scoreBoxWidth - 10) / Math.max(1, layout.width)))
        : 1,
    )
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
    ? {
        ...revealCopyStyle(layout, 1),
        ...typography,
        animation: 'none',
        transform: 'none',
        visibility: 'hidden',
      }
    : undefined
  return (
    <>
      <strong
        ref={measurementRef}
        className="match-reveal-copy total-reveal-score total-team-score"
        style={copyStyle}
      >
        {score}
        <span className="total-score-unit">pts</span>
      </strong>
      {adjustedLayout && (
        <strong
          className="match-reveal-copy total-reveal-score total-team-score"
          style={{ ...revealCopyStyle(adjustedLayout, sourceScale), ...typography }}
        >
          {score}
          <span className="total-score-unit">pts</span>
        </strong>
      )}
    </>
  )
}

export function MatchReveal({
  layout,
  matchup,
  homeHeadingRef,
  awayHeadingRef,
  scoreRef,
}: {
  layout: RevealLayout | null
  matchup: MatchupView
  homeHeadingRef: RefObject<HTMLHeadingElement | null>
  awayHeadingRef: RefObject<HTMLHeadingElement | null>
  scoreRef: RefObject<HTMLElement | null>
}) {
  const viewportWidth = layout?.viewportWidth ?? window.innerWidth
  return (
    <div className="match-reveal-overlay" aria-hidden="true">
      <div className="match-reveal-sheet" />
      {layout && (
        <>
          <RevealTeamCopy
            className="reveal-home"
            layout={layout.home}
            scoreLayout={layout.score}
            viewportWidth={viewportWidth}
            name={matchup.home.clubName}
            headingRef={homeHeadingRef}
          />
          <RevealScoreCopy
            layout={layout.score}
            score={formatScoreline(matchup.scoreline)}
            scoreRef={scoreRef}
          />
          <RevealTeamCopy
            className="reveal-away"
            layout={layout.away}
            scoreLayout={layout.score}
            viewportWidth={viewportWidth}
            name={matchup.away.clubName}
            headingRef={awayHeadingRef}
          />
        </>
      )}
    </div>
  )
}

function RevealScoreCopy({
  layout,
  score,
  scoreRef,
}: {
  layout: RevealLayout['score']
  score: string
  scoreRef: RefObject<HTMLElement | null>
}) {
  const [typography, setTypography] = useState<CSSProperties>()
  useLayoutEffect(() => {
    const scoreElement = scoreRef.current
    if (!scoreElement) return
    const style = window.getComputedStyle(scoreElement)
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
  }, [scoreRef, layout])
  return (
    <strong
      className="match-reveal-copy match-reveal-score"
      style={{ ...revealCopyStyle(layout, 1.08), ...typography }}
    >
      {score}
    </strong>
  )
}

function RevealTeamCopy({
  className,
  layout,
  scoreLayout,
  viewportWidth,
  name,
  headingRef,
  initialScaleMultiplier = 1,
}: {
  className: string
  layout: RevealLayout['home']
  scoreLayout: RevealLayout['score']
  viewportWidth: number
  name: string
  headingRef: RefObject<HTMLElement | null>
  initialScaleMultiplier?: number
}) {
  const [revealScale, setRevealScale] = useState(1)
  const [typography, setTypography] = useState<CSSProperties>()
  const [sourceFontSize, setSourceFontSize] = useState<number>()
  useLayoutEffect(() => {
    const heading = headingRef.current
    if (!heading) return
    const style = window.getComputedStyle(heading)
    setTypography({
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing,
      textTransform: style.textTransform,
    })
    const context = document.createElement('canvas').getContext('2d')
    if (!context) return
    const naturalSize = Number.parseFloat(style.fontSize)
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    const textWidth = context.measureText(name).width
    setSourceFontSize((naturalSize * (viewportWidth * 0.8)) / Math.max(1, textWidth))
    const scoreHalfWidth = (scoreLayout.width * 1.08) / 2
    const scoreCentre = viewportWidth / 2
    const revealGap = viewportWidth * 0.05
    const availableWidth =
      className === 'reveal-home'
        ? scoreCentre - scoreHalfWidth - revealGap - viewportWidth * 0.05
        : viewportWidth - viewportWidth * 0.05 - scoreCentre - scoreHalfWidth - revealGap
    setRevealScale(Math.min(1, Math.max(0.24, availableWidth / Math.max(1, textWidth))))
  }, [className, headingRef, name, scoreLayout.width, viewportWidth])
  const revealCopyScale = revealScale * initialScaleMultiplier
  const scoreHalfWidth = (scoreLayout.width * 1.08) / 2
  const revealGap = viewportWidth * 0.05
  const finalCentre = layout.left + layout.width / 2
  const initialCentre =
    className === 'reveal-home'
      ? viewportWidth / 2 - scoreHalfWidth - revealGap - (layout.width * revealCopyScale) / 2
      : viewportWidth / 2 + scoreHalfWidth + revealGap + (layout.width * revealCopyScale) / 2
  return (
    <strong
      className={`match-reveal-copy match-reveal-team ${className}`}
      style={
        {
          ...revealCopyStyle(layout, revealCopyScale),
          ...typography,
          '--reveal-x': `${initialCentre - finalCentre}px`,
          '--reveal-box-width': `${layout.width}px`,
          '--reveal-source-font-size': `${sourceFontSize ?? 0}px`,
          '--reveal-final-font-size': typography?.fontSize ?? 'inherit',
        } as CSSProperties
      }
    >
      <span>{name}</span>
    </strong>
  )
}

export function LeaderboardReveal({
  layout,
  headingRef,
  label = 'Live Leaderboard',
}: {
  layout: RevealRect | null
  headingRef: RefObject<HTMLHeadingElement | null>
  label?: string
}) {
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
  return (
    <div className="match-reveal-overlay leaderboard-reveal" aria-hidden="true">
      <div className="match-reveal-sheet" />
      <strong
        className="match-reveal-copy leaderboard-reveal-copy"
        style={{ ...revealCopyStyle(layout, 1), ...typography }}
      >
        {label}
      </strong>
    </div>
  )
}
