const KEY = 'fb:registration-intent'
const LIFETIME_MS = 30 * 60 * 1000
const DESTINATIONS = [
  '/leagues/new',
  '/leagues/new?plan=STANDARD',
  '/leagues/new?plan=AI_BROADCASTER',
] as const
export type RegistrationDestination = (typeof DESTINATIONS)[number]

export function registrationDestination(search: string): RegistrationDestination | undefined {
  const params = new URLSearchParams(search)
  if (params.get('next') !== 'register') return undefined
  const plan = params.get('plan')
  return plan === 'STANDARD' || plan === 'AI_BROADCASTER'
    ? `/leagues/new?plan=${plan}`
    : '/leagues/new'
}

export function rememberRegistrationIntent(search: string) {
  const destination = registrationDestination(search)
  try {
    if (destination)
      sessionStorage.setItem(
        KEY,
        JSON.stringify({ destination, expiresAt: Date.now() + LIFETIME_MS }),
      )
    else if (new URLSearchParams(search).get('oauth') !== 'failed') sessionStorage.removeItem(KEY)
  } catch {
    /* Direct password authentication still uses the validated URL destination. */
  }
}

export function consumeRegistrationIntent(): RegistrationDestination | undefined {
  try {
    const stored = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    const value: unknown = stored ? JSON.parse(stored) : null
    if (!value || typeof value !== 'object' || !('destination' in value) || !('expiresAt' in value))
      return
    const destination = DESTINATIONS.find((path) => path === value.destination)
    if (!destination) return
    if (
      typeof value.expiresAt !== 'number' ||
      value.expiresAt <= Date.now() ||
      value.expiresAt > Date.now() + LIFETIME_MS
    )
      return
    return destination
  } catch {
    return undefined
  }
}
