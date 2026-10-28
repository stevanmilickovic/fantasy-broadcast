import type { Navigate } from '../../app/useBrowserNavigation'

export function LeagueTeamLink({
  href,
  name,
  navigate,
}: {
  href: string
  name: string
  navigate: Navigate
}) {
  return (
    <a
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
      {name}
    </a>
  )
}
