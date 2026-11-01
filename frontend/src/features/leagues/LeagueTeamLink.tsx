import type { Navigate } from '../../app/useBrowserNavigation'
import { TeamEmblem } from './TeamEmblem'

export function LeagueTeamLink({
  href,
  name,
  navigate,
  entryId,
}: {
  href: string
  name: string
  navigate: Navigate
  entryId: number
}) {
  return (
    <a
      className="league-team-link"
      href={href}
      onClick={(event) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return
        event.preventDefault()
        navigate(href)
      }}
    >
      <TeamEmblem entryId={entryId} />
      <span>{name}</span>
    </a>
  )
}
