import { useLayoutEffect, useRef } from 'react'
import { TeamEmblem } from '../leagues/TeamEmblem'
import { useReducedMotion } from './useReducedMotion'
import type { LiveStandingView } from './types'

export function LiveStandings({
  standings,
  focusedId,
  scoring,
  reveal = false,
}: {
  standings: LiveStandingView[]
  focusedId?: string
  scoring: 'h2h' | 'points'
  reveal?: boolean
}) {
  const rows = useRef(new Map<string, HTMLTableRowElement>())
  const positions = useRef(new Map<string, number>())
  const reduced = useReducedMotion()
  const scroller = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const effects: Animation[] = []
    const next = new Map<string, number>()
    rows.current.forEach((row, id) => {
      const top = row.offsetTop
      const previous = positions.current.get(id)
      if (!reduced && previous !== undefined && previous !== top && row.animate)
        effects.push(
          row.animate(
            [{ transform: `translateY(${previous - top}px)` }, { transform: 'translateY(0)' }],
            { duration: 380, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
          ),
        )
      next.set(id, top)
    })
    positions.current = next
    return () => effects.forEach((effect) => effect.cancel())
  }, [standings, reduced])
  useLayoutEffect(() => {
    const row = focusedId ? rows.current.get(focusedId) : undefined
    const container = scroller.current
    if (row && container)
      container.scrollTop = Math.max(0, row.offsetTop - container.clientHeight / 2)
  }, [focusedId])
  return (
    <section
      className="broadcast-standings"
      aria-label={scoring === 'h2h' ? 'Live leaderboard' : 'Live standings'}
    >
      <header data-reveal-cell>
        <h2 {...(reveal ? { 'data-reveal-role': 'heading' } : {})}>
          {scoring === 'h2h' ? 'Live leaderboard' : 'Live standings'}
        </h2>
        <p>{scoring === 'h2h' ? 'Projected league points' : 'Season rankings'}</p>
      </header>
      <div
        className="broadcast-table-scroll"
        ref={scroller}
        tabIndex={0}
        aria-label="All club standings"
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Club / manager</th>
              <th scope="col">GW pts</th>
              <th scope="col">{scoring === 'h2h' ? 'League pts' : 'Total pts'}</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((standing) => (
              <tr
                key={standing.teamId}
                ref={(row) => {
                  if (row) rows.current.set(standing.teamId, row)
                  else rows.current.delete(standing.teamId)
                }}
                className={standing.teamId === focusedId ? 'focused-standing' : ''}
              >
                <td>{standing.position}</td>
                <th scope="row">
                  <strong>
                    <TeamEmblem managerId={standing.teamId} />
                    {standing.teamName}
                  </strong>
                  <span>{standing.managerName}</span>
                </th>
                <td>{standing.gameweekPoints}</td>
                <td>{standing.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
