import { useEffect } from 'react'
import './styles.css'
import { AdministrationPage } from '../features/administration/AdministrationPage'
import { AuthScreen } from '../features/auth/AuthScreen'
import { AccountSettings } from '../features/auth/AccountSettings'
import { AccountDeletionPage } from '../features/auth/AccountDeletionPage'
import { useAuthSession } from '../features/auth/useAuthSession'
import { BroadcastPage } from '../features/broadcast/BroadcastPage'
import { AccountSubscriptionsPage } from '../features/billing/AccountSubscriptionsPage'
import { PaymentLinkPage } from '../features/billing/PaymentLinkPage'
import { CustomerDashboard } from '../features/leagues/CustomerDashboard'
import { PublicPage } from '../features/public/PublicPages'
import { PreviewLeaguePage } from '../features/public/PreviewLeaguePage'
import { WelcomePage } from '../features/public/WelcomePage'
import { resolveRoute } from './routes'
import { useBrowserNavigation, type Navigate } from './useBrowserNavigation'
import { NotificationProvider } from '../shared/ui/NotificationProvider'
import { registrationDestination } from '../features/auth/registrationIntent'

function Redirect({ to, navigate }: { to: string; navigate: Navigate }) {
  useEffect(() => navigate(to, true), [to, navigate])
  return null
}

export default function App() {
  const { location, navigate } = useBrowserNavigation()
  const session = useAuthSession(navigate)
  return (
    <NotificationProvider key={session.user?.id ?? 'guest'}>
      <AppContent session={session} location={location} navigate={navigate} />
    </NotificationProvider>
  )
}

function AppContent({
  session,
  location,
  navigate,
}: {
  session: ReturnType<typeof useAuthSession>
  location: ReturnType<typeof useBrowserNavigation>['location']
  navigate: Navigate
}) {
  const route = resolveRoute(location.pathname, location.search, session.user)
  const passwordChanged = () => {
    session.updateUser(null)
    navigate('/login?password=changed', true)
  }
  if (route.page === 'payment-link')
    return <PaymentLinkPage search={location.search} navigate={navigate} />
  if (route.page === 'preview-league')
    return <PreviewLeaguePage search={location.search} navigate={navigate} />
  if (session.isLoading)
    return (
      <main className="account-shell">
        <p>Checking your session…</p>
      </main>
    )
  switch (route.page) {
    case 'redirect':
      return <Redirect to={route.to} navigate={navigate} />
    case 'welcome':
      return <WelcomePage onNavigate={navigate} />
    case 'public':
      return <PublicPage page={route.name} onNavigate={navigate} />
    case 'auth':
      return (
        <AuthScreen
          key={route.pathname}
          pathname={route.pathname}
          search={location.search}
          onAuthenticated={(result) =>
            session.handleAuthenticated(result, registrationDestination(location.search))
          }
          onNavigate={navigate}
          onPasswordReset={passwordChanged}
        />
      )
  }
  if (!session.user) return null
  switch (route.page) {
    case 'account':
      return (
        <AccountSettings
          user={session.user}
          onUpdated={session.updateUser}
          navigate={navigate}
          onPasswordChanged={passwordChanged}
        />
      )
    case 'account-deletion':
      return (
        <main className="account-shell account-settings">
          <button type="button" className="checkout-back" onClick={() => navigate('/account')}>
            Back to account settings
          </button>
          <AccountDeletionPage />
        </main>
      )
    case 'subscriptions':
      return (
        <AccountSubscriptionsPage
          key={`${session.user.id}:${route.leagueId ?? 'overview'}`}
          leagueId={route.leagueId}
          user={session.user}
          navigate={navigate}
          onSignOut={() => void session.signOut()}
        />
      )
    case 'administration':
      return (
        <AdministrationPage user={session.user} navigate={navigate} signOut={session.signOut} />
      )
    case 'broadcast':
      return (
        <BroadcastPage
          key={`${session.user.id}:${route.leagueId ?? 'global'}`}
          user={session.user}
          leagueId={route.leagueId}
          navigate={navigate}
        />
      )
    case 'leagues':
      return (
        <CustomerDashboard
          user={session.user}
          pathname={route.pathname}
          search={location.search}
          onNavigate={navigate}
          onSignOut={() => void session.signOut()}
        />
      )
  }
}
