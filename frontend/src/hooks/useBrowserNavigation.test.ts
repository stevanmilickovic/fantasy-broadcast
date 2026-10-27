import { act, renderHook } from '@testing-library/react'
import { expect, it } from 'vitest'
import { useBrowserNavigation } from './useBrowserNavigation'

it('reads deep links and follows navigation and browser history events', () => {
  window.history.replaceState({}, '', '/broadcast?leagueId=42')
  const { result } = renderHook(useBrowserNavigation)
  expect(result.current.location).toEqual({ pathname: '/broadcast', search: '?leagueId=42' })
  act(() => result.current.navigate('/leagues', true))
  expect(result.current.location.pathname).toBe('/leagues')
  act(() => {
    window.history.replaceState({}, '', '/league?leagueId=5')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  expect(result.current.location).toEqual({ pathname: '/league', search: '?leagueId=5' })
})
