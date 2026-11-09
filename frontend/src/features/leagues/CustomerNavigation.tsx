import { useDismissibleMenus } from './useDismissibleMenus'
import type { AuthUser } from '../auth/types'
export function CustomerNavigation({
  user,
  onNavigate,
  onSignOut,
}: {
  user: AuthUser
  onNavigate: (path: string) => void
  onSignOut: () => void
}) {
  const menuRef = useDismissibleMenus()
  return (
    <nav className="customer-navigation">
      <button
        className="customer-brand brand-name"
        type="button"
        onClick={() => onNavigate('/leagues')}
      >
        Fantasy Broadcast
      </button>
      <div className="customer-navigation-actions" ref={menuRef}>
        <details className="profile-menu">
          <summary aria-label="Account menu">
            <span className="league-avatar">{user.displayName.slice(0, 1)}</span>
            <span className="account-label">Account</span>
          </summary>
          <div>
            <strong>{user.displayName}</strong>
            <button type="button" onClick={() => onNavigate('/leagues/find')}>
              Find leagues
            </button>
            <button type="button" onClick={() => onNavigate('/leagues/new')}>
              Register a league
            </button>
            <button type="button" onClick={() => onNavigate('/account')}>
              Account settings
            </button>
            <button type="button" onClick={onSignOut}>
              Sign out
            </button>
          </div>
        </details>
      </div>
    </nav>
  )
}
