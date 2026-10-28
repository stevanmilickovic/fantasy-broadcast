import { useLayoutEffect, useRef, useState } from 'react'
import { toRevealRect, toScoreRevealRect, TOTAL_POINTS_REVEAL_TEAM_SCALE } from './broadcast'
import type { LiveStateResponse, RevealLayout, RevealRect } from './types'

const TOTAL_SCORE_REVEAL_Y_CORRECTION = 1

export function useBroadcastMeasurement({
  liveState,
  displayedFocusId,
  displayingLeaderboard,
  isTotalPointsBroadcast,
  isBroadcastRoute,
}: {
  liveState: LiveStateResponse | null
  displayedFocusId: string | null
  displayingLeaderboard: boolean
  isTotalPointsBroadcast: boolean
  isBroadcastRoute: boolean
}) {
  const [revealLayout, setRevealLayout] = useState<RevealLayout | null>(null)
  const [leaderboardRevealLayout, setLeaderboardRevealLayout] = useState<RevealRect | null>(null)
  const homeHeadingRef = useRef<HTMLHeadingElement>(null)
  const awayHeadingRef = useRef<HTMLHeadingElement>(null)
  const scoreRef = useRef<HTMLElement>(null)
  const totalTeamNameRef = useRef<HTMLSpanElement>(null)
  const totalHeadingRef = useRef<HTMLHeadingElement>(null)
  const leaderboardHeadingRef = useRef<HTMLHeadingElement>(null)
  useLayoutEffect(() => {
    if (!isBroadcastRoute) return
    const measure = () => {
      if (displayingLeaderboard) {
        if (!leaderboardHeadingRef.current) return
        setLeaderboardRevealLayout(
          toRevealRect(
            leaderboardHeadingRef.current.getBoundingClientRect(),
            window.innerWidth / 2,
          ),
        )
        return
      }

      if (!scoreRef.current) return
      if (isTotalPointsBroadcast) {
        if (!totalTeamNameRef.current) return
        const teamNameRect = totalTeamNameRef.current.getBoundingClientRect()
        const scoreRect = scoreRef.current.getBoundingClientRect()
        const compactTransition = window.matchMedia('(max-width: 900px)').matches
        const revealGap = 24
        const teamNameStyle = window.getComputedStyle(totalTeamNameRef.current)
        const teamNameMeasure = document.createElement('canvas').getContext('2d')
        if (!teamNameMeasure) return
        teamNameMeasure.font = `${teamNameStyle.fontWeight} ${teamNameStyle.fontSize} ${teamNameStyle.fontFamily}`
        const textWidth = teamNameMeasure.measureText(
          totalTeamNameRef.current.textContent ?? '',
        ).width
        const monitorTeamStartCentre = window.innerWidth / 2 - (scoreRect.width + revealGap) / 2
        const availableWidth =
          window.innerWidth / 2 -
          (scoreRect.width * 1.08) / 2 -
          42 -
          (monitorTeamStartCentre - teamNameRect.width / 2)
        const fittedScale = Math.min(1, Math.max(0.24, availableWidth / Math.max(1, textWidth)))
        const horizontalMargin = window.innerWidth * 0.05
        const transitionWidth = window.innerWidth - horizontalMargin * 2
        const teamBoxWidth = transitionWidth * 0.75
        const scoreBoxWidth = transitionWidth * 0.25
        const teamStartCentre = compactTransition
          ? horizontalMargin + teamBoxWidth / 2
          : monitorTeamStartCentre
        const scoreStartCentre = compactTransition
          ? horizontalMargin + teamBoxWidth + scoreBoxWidth / 2
          : monitorTeamStartCentre +
            (textWidth * fittedScale * TOTAL_POINTS_REVEAL_TEAM_SCALE) / 2 +
            revealGap +
            scoreRect.width / 2
        const scoreReveal = toRevealRect(scoreRect, scoreStartCentre)
        setRevealLayout({
          home: toRevealRect(teamNameRect, teamStartCentre),
          score: {
            ...scoreReveal,
            top: scoreReveal.top + TOTAL_SCORE_REVEAL_Y_CORRECTION,
            revealY: scoreReveal.revealY - TOTAL_SCORE_REVEAL_Y_CORRECTION,
          },
          away: toRevealRect(teamNameRect, window.innerWidth / 2),
        })
        return
      }

      if (!homeHeadingRef.current || !awayHeadingRef.current) return
      setRevealLayout({
        home: toRevealRect(
          homeHeadingRef.current.getBoundingClientRect(),
          window.innerWidth * 0.27,
        ),
        score: toScoreRevealRect(scoreRef.current.getBoundingClientRect()),
        away: toRevealRect(
          awayHeadingRef.current.getBoundingClientRect(),
          window.innerWidth * 0.73,
        ),
        viewportWidth: window.innerWidth,
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    const elements = [
      homeHeadingRef.current,
      awayHeadingRef.current,
      scoreRef.current,
      totalTeamNameRef.current,
      leaderboardHeadingRef.current,
    ]
    elements.forEach((element) => {
      if (element) observer.observe(element)
    })
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [isBroadcastRoute, isTotalPointsBroadcast, displayedFocusId, displayingLeaderboard, liveState])

  return {
    revealLayout,
    leaderboardRevealLayout,
    homeHeadingRef,
    awayHeadingRef,
    scoreRef,
    totalTeamNameRef,
    totalHeadingRef,
    leaderboardHeadingRef,
  }
}
