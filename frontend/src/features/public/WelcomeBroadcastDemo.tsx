import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { BroadcastMatchday } from '../broadcast/BroadcastMatchday'
import type { BroadcastFocus, RevealLayout, RevealRect } from '../broadcast/types'
import { welcomeBroadcastState, welcomeDemoFrames, welcomeShirtCodes } from './welcomeDemoData'

const FIXTURE_LINGER_MS = 10_000
const INITIAL_FIXTURE_LINGER_MS = 4_000
const SCENE_SWAP_MS = 800
const SCENE_END_MS = 1_600
const REVEAL_END_MS = 2_700
const CYCLE_MS = FIXTURE_LINGER_MS + REVEAL_END_MS

export function WelcomeBroadcastDemo() {
  const [frameIndex, setFrameIndex] = useState(0)
  const [transitioning, setTransitioning] = useState(false)
  const [revealing, setRevealing] = useState(false)
  const [revealLayout, setRevealLayout] = useState<RevealLayout | null>(null)
  const [selectedFocus, setSelectedFocus] = useState<BroadcastFocus>('match-one')
  const scaleLayerRef = useRef<HTMLDivElement>(null)
  const homeHeadingRef = useRef<HTMLHeadingElement>(null)
  const awayHeadingRef = useRef<HTMLHeadingElement>(null)
  const scoreRef = useRef<HTMLElement>(null)
  const totalTeamNameRef = useRef<HTMLSpanElement>(null)
  const totalHeadingRef = useRef<HTMLHeadingElement>(null)
  const leaderboardHeadingRef = useRef<HTMLHeadingElement>(null)
  const pendingRevealRef = useRef(false)
  const state = welcomeBroadcastState(frameIndex)
  const automaticMatchup = state.matchups[welcomeDemoFrames[frameIndex].matchupIndex]
  const matchup =
    state.matchups.find((candidate) => candidate.id === selectedFocus) ?? automaticMatchup

  useLayoutEffect(() => {
    if (!pendingRevealRef.current) return
    pendingRevealRef.current = false
    setRevealLayout(
      measureRevealLayout(
        scaleLayerRef.current,
        homeHeadingRef.current,
        scoreRef.current,
        awayHeadingRef.current,
      ),
    )
    setRevealing(true)
  }, [frameIndex])

  useEffect(() => {
    const transitionTimers: number[] = []
    const startTransition = () => {
      transitionTimers.splice(0).forEach((timer) => window.clearTimeout(timer))
      setTransitioning(true)
      transitionTimers.push(
        window.setTimeout(() => {
          pendingRevealRef.current = true
          setFrameIndex((current) => {
            const next = (current + 1) % welcomeDemoFrames.length
            setSelectedFocus(welcomeDemoFrames[next].matchupIndex === 0 ? 'match-one' : 'match-two')
            return next
          })
        }, SCENE_SWAP_MS),
        window.setTimeout(() => setTransitioning(false), SCENE_END_MS),
        window.setTimeout(() => setRevealing(false), REVEAL_END_MS),
      )
    }
    let interval: number | undefined
    const initialTransition = window.setTimeout(() => {
      startTransition()
      interval = window.setInterval(startTransition, CYCLE_MS)
    }, INITIAL_FIXTURE_LINGER_MS)
    return () => {
      window.clearTimeout(initialTransition)
      if (interval !== undefined) window.clearInterval(interval)
      transitionTimers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [])

  return (
    <div className="welcome-real-broadcast" aria-label="Interactive example of the live broadcast">
      <div className="welcome-broadcast-scale" ref={scaleLayerRef}>
        <BroadcastMatchday
          shirtCodesOverride={welcomeShirtCodes}
          displayLiveState={state}
          matchup={matchup}
          latestCommentaryId={state.commentary[0].id}
          latestCommentaryText={state.commentary[0].text}
          latestCommentaryStatus={state.commentary[0].status}
          leaderName={
            matchup.leaderManagerId === matchup.home.managerId
              ? matchup.home.displayName
              : matchup.away.displayName
          }
          broadcastFocus={selectedFocus}
          automaticFocus={automaticMatchup.id}
          presentation={{
            revealingMatch: revealing,
            revealLayout,
            transitioningToMatch: transitioning,
            visibleEventId: !transitioning && !revealing ? state.events[0].id : null,
            homeHeadingRef,
            awayHeadingRef,
            scoreRef,
            totalTeamNameRef,
            totalHeadingRef,
            showingLiveLeaderboard: false,
            leaderboardRevealLayout: null,
            leaderboardHeadingRef,
            holdingPendingUpdates: transitioning || revealing,
          }}
          standings={state.standings}
          onBack={() => undefined}
          onSelectFocus={(focus) => {
            if (focus !== 'multi') setSelectedFocus(focus)
          }}
        />
      </div>
    </div>
  )
}

function measureRevealLayout(
  layer: HTMLDivElement | null,
  home: HTMLElement | null,
  score: HTMLElement | null,
  away: HTMLElement | null,
): RevealLayout | null {
  if (!layer || !home || !score || !away) return null
  const canvasWidth = layer.offsetWidth
  const canvasHeight = layer.offsetHeight
  const homeRect = relativeRect(home, layer)
  const scoreRect = relativeRect(score, layer)
  const awayRect = relativeRect(away, layer)
  return {
    home: revealRect(homeRect, canvasWidth * 0.27, canvasHeight),
    score: revealRect(scoreRect, canvasWidth * 0.5, canvasHeight),
    away: revealRect(awayRect, canvasWidth * 0.73, canvasHeight),
    viewportWidth: canvasWidth,
  }
}

function relativeRect(element: HTMLElement, ancestor: HTMLElement) {
  let left = 0
  let top = 0
  let current: HTMLElement | null = element
  while (current && current !== ancestor) {
    left += current.offsetLeft
    top += current.offsetTop
    const transform = window.getComputedStyle(current).transform
    if (transform !== 'none') {
      const matrix = new DOMMatrixReadOnly(transform)
      left += matrix.m41
      top += matrix.m42
    }
    current = current.offsetParent as HTMLElement | null
  }
  return { left, top, width: element.offsetWidth, height: element.offsetHeight }
}

function revealRect(
  rect: { left: number; top: number; width: number; height: number },
  startCenterX: number,
  canvasHeight: number,
): RevealRect {
  return {
    ...rect,
    revealX: startCenterX - (rect.left + rect.width / 2),
    revealY: canvasHeight / 2 - (rect.top + rect.height / 2),
  }
}
