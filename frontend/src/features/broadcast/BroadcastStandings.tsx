import { useLayoutEffect, useRef, useState, useEffect, type RefObject } from 'react'
import type { LiveStandingView, TeamView } from './types'

export function HeadToHeadLeaderboard({
  standings,
  headingRef,
}: {
  standings: LiveStandingView[]
  headingRef: RefObject<HTMLHeadingElement | null>
}) {
  return (
    <section className="live-leaderboard-page" aria-label="Live leaderboard">
      <LiveStandings
        standings={standings}
        headingRef={headingRef}
        label="Live Leaderboard"
        showUnsignedLivePoints
      />
    </section>
  )
}

export function TotalPointsLeaderboard({
  standings,
  headingRef,
}: {
  standings: LiveStandingView[]
  headingRef: RefObject<HTMLHeadingElement | null>
}) {
  return (
    <section className="live-leaderboard-page" aria-label="Live standings">
      <LiveStandings standings={standings} headingRef={headingRef} label="Live standings" />
    </section>
  )
}

export function LiveStandings({
  standings,
  focusedTeam,
  headingRef,
  label = 'Live standings',
  showUnsignedLivePoints = false,
}: {
  standings: LiveStandingView[]
  focusedTeam?: TeamView
  headingRef?: RefObject<HTMLHeadingElement | null>
  label?: string
  showUnsignedLivePoints?: boolean
}) {
  const rowElements = useRef(new Map<string, HTMLLIElement>())
  const previousRowTops = useRef(new Map<string, number>())
  useLayoutEffect(() => {
    const nextRowTops = new Map<string, number>()
    rowElements.current.forEach((element, teamId) => {
      const top = element.getBoundingClientRect().top
      const previousTop = previousRowTops.current.get(teamId)
      if (previousTop !== undefined && previousTop !== top) {
        element.animate(
          [{ transform: `translateY(${previousTop - top}px)` }, { transform: 'translateY(0)' }],
          { duration: 560, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
        )
      }
      nextRowTops.set(teamId, top)
    })
    previousRowTops.current = nextRowTops
  }, [standings])
  return (
    <aside
      className={`live-standings ${showUnsignedLivePoints ? 'h2h-live-standings' : ''}`}
      aria-label={label}
    >
      <header>
        <strong ref={headingRef}>{label}</strong>
      </header>
      <ol>
        {standings.slice(0, 12).map((standing) => (
          <li
            ref={(element) => {
              if (element) rowElements.current.set(standing.teamId, element)
              else rowElements.current.delete(standing.teamId)
            }}
            key={standing.teamId}
            className={standing.teamId === focusedTeam?.managerId ? 'focused-standing' : ''}
          >
            <b>{standing.position}</b>
            <div>
              <strong>{standing.teamName}</strong>
              <span>{standing.managerName}</span>
            </div>
            {!showUnsignedLivePoints && (
              <StandingValue
                className="standing-gameweek-points"
                value={standing.gameweekPoints}
                signed
              />
            )}
            <StandingValue className="standing-total-points" value={standing.total} />
          </li>
        ))}
      </ol>
    </aside>
  )
}

function StandingValue({
  value,
  signed = false,
  className,
}: {
  value: number
  signed?: boolean
  className: string
}) {
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
      interval = window.setInterval(
        () =>
          setDisplayValue((current) => {
            const next = current + direction
            if ((direction > 0 && next >= value) || (direction < 0 && next <= value)) {
              if (interval) window.clearInterval(interval)
              return value
            }
            return next
          }),
        Math.max(70, Math.round(360 / Math.max(1, Math.abs(difference)))),
      )
    }, 240)
    return () => {
      window.clearTimeout(delay)
      if (interval) window.clearInterval(interval)
    }
  }, [value])
  const text = `${signed && displayValue >= 0 ? '+' : ''}${displayValue}`
  return className === 'standing-total-points' ? (
    <em className={className}>{text}</em>
  ) : (
    <small className={className}>{text}</small>
  )
}
