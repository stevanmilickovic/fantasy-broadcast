import type { AuthUser } from '../features/auth/types'
import { registrationDestination } from '../features/auth/registrationIntent'

export type PublicPageName = 'pricing' | 'privacy' | 'terms' | 'refunds'
export type Route =
  | { page: 'welcome' }
  | { page: 'preview-league' }
  | { page: 'payment-link' }
  | { page: 'public'; name: PublicPageName }
  | { page: 'auth'; pathname: string }
  | { page: 'leagues'; pathname: string }
  | { page: 'administration' }
  | { page: 'account' }
  | { page: 'account-deletion' }
  | { page: 'subscriptions'; leagueId?: number }
  | { page: 'broadcast'; leagueId?: number }
  | { page: 'redirect'; to: string }

export function positiveId(value: string | null): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : undefined
}

export function resolveRoute(pathname: string, search: string, user: AuthUser | null): Route {
  if (pathname === '/pay') return { page: 'payment-link' }
  if (pathname === '/preview-league') return { page: 'preview-league' }
  if (pathname === '/reset-password') return { page: 'auth', pathname }
  switch (pathname) {
    case '/pricing':
    case '/privacy':
    case '/terms':
    case '/refunds':
      return { page: 'public', name: pathname.slice(1) as PublicPageName }
  }
  if (
    pathname === '/leagues/new' &&
    (new URLSearchParams(search).has('search') || new URLSearchParams(search).has('page'))
  )
    return { page: 'redirect', to: `/leagues/find${search}` }
  if (!user) {
    if (pathname === '/leagues/new') {
      const params = new URLSearchParams(search)
      const next = new URLSearchParams({ next: 'register' })
      if (params.get('plan') === 'STANDARD' || params.get('plan') === 'AI_BROADCASTER')
        next.set('plan', params.get('plan') ?? '')
      return { page: 'redirect', to: `/register?${next}` }
    }
    if (pathname === '/') return { page: 'welcome' }
    if (pathname === '/login' || pathname === '/register') return { page: 'auth', pathname }
    return { page: 'redirect', to: '/login' }
  }
  if (pathname === '/broadcast') {
    const leagueId = positiveId(new URLSearchParams(search).get('leagueId'))
    if (new URLSearchParams(search).has('leagueId') && !leagueId)
      return { page: 'redirect', to: '/leagues' }
    if (!leagueId && user.role !== 'ADMIN') return { page: 'redirect', to: '/leagues' }
    return { page: 'broadcast', leagueId }
  }
  if (pathname === '/account') return { page: 'account' }
  if (pathname === '/account-deletion') return { page: 'account-deletion' }
  if (pathname === '/account/subscriptions')
    return {
      page: 'subscriptions',
      leagueId: positiveId(new URLSearchParams(search).get('leagueId')),
    }
  if (pathname === '/register' || pathname === '/login') {
    const destination = registrationDestination(search)
    if (destination) return { page: 'redirect', to: destination }
  }
  if (pathname === '/league/subscription')
    return { page: 'redirect', to: `/league/manage${search}` }
  if (pathname === '/administration' && user.role === 'ADMIN') return { page: 'administration' }
  if (
    [
      '/league',
      '/league/manage',
      '/leagues',
      '/leagues/new',
      '/leagues/find',
      '/leagues/checkout',
    ].includes(pathname)
  ) {
    return { page: 'leagues', pathname }
  }
  return { page: 'redirect', to: user.role === 'ADMIN' ? '/administration' : '/leagues' }
}
