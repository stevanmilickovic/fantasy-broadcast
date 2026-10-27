import type { Navigate } from '../../app/useBrowserNavigation'
import { LegalFooter } from '../../shared/ui/LegalFooter'
import type { AuthUser } from '../auth/types'
import { AdministrationScreen } from './AdministrationScreen'
import { useBroadcastSetup } from './useBroadcastSetup'

export function AdministrationPage({
  user,
  navigate,
  signOut,
}: {
  user: AuthUser
  navigate: Navigate
  signOut: () => Promise<void>
}) {
  const { error, leagueSetup, broadcastControls } = useBroadcastSetup(navigate)
  return (
    <div className="administration-page">
      {error && (
        <p className="discovery-error" role="alert">
          {error}
        </p>
      )}
      <AdministrationScreen
        session={{
          user,
          onOpenLeague: (id) => navigate(`/league?leagueId=${id}`),
          onSignOut: () => void signOut(),
        }}
        leagueSetup={leagueSetup}
        broadcastControls={broadcastControls}
      />
      <LegalFooter onNavigate={navigate} className="administration-legal-footer" />
    </div>
  )
}
