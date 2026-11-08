import type { Navigate } from '../../app/useBrowserNavigation'

export function LeagueWorkspaceNavigation({
  pathname,
  navigate,
}: {
  pathname: string
  navigate: Navigate
}) {
  return (
    <nav className="league-workspace-navigation" aria-label="League workspace">
      {[
        ['/leagues', 'My leagues'],
        ['/leagues/find', 'Find leagues'],
        ['/leagues/new', 'Register'],
      ].map(([path, label]) => (
        <a
          key={path}
          href={path}
          aria-current={
            pathname === path
              ? 'page'
              : path === '/leagues/new' && pathname === '/leagues/checkout'
                ? 'step'
                : (path === '/leagues' && pathname.startsWith('/league/')) ||
                    (path === '/leagues' && pathname === '/league')
                  ? 'location'
                  : undefined
          }
          onClick={(event) => {
            if (
              event.button === 0 &&
              !event.ctrlKey &&
              !event.metaKey &&
              !event.shiftKey &&
              !event.altKey
            ) {
              event.preventDefault()
              navigate(path)
            }
          }}
        >
          {label}
        </a>
      ))}
    </nav>
  )
}
