import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { welcomeLeagueDiscovery } from '../public/welcomeDemoData'
import { LeagueTeamVisual } from './LeagueTeamVisual'
import type { LeagueDiscoveryState } from '../../shared/fpl/types'

it('counts starters only and distinguishes played zero points from an unused player', () => {
  const discovery: LeagueDiscoveryState = {
    ...welcomeLeagueDiscovery,
    gameweek: 24,
    players: [1, 2, 3].map((id) => ({
      id,
      webName: `Player ${id}`,
      fullName: `Player ${id}`,
      premierLeagueClub: 'Arsenal',
      position: 'MID',
    })),
    elementStatus: {
      element_status: [1, 2, 3].map((element) => ({
        element,
        owner: 1,
        status: 'o',
        in_accepted_trade: false,
      })),
    },
    entryEvents: {
      '1': {
        picks: [1, 2, 3].map((element, index) => ({
          element,
          position: index === 0 ? 1 : index + 11,
          multiplier: index === 0 ? 1 : 0,
          starter: index === 0,
          benched: index !== 0,
        })),
      },
    },
    livePlayers: [1, 2, 3].map((id) => ({
      id,
      stats: {
        minutes: id === 3 ? 0 : 90,
        totalPoints: id === 2 ? 8 : 0,
        goalsScored: 0,
        assists: 0,
        cleanSheets: 0,
        goalsConceded: 0,
        ownGoals: 0,
        penaltiesSaved: 0,
        penaltiesMissed: 0,
        yellowCards: 0,
        redCards: 0,
        saves: 0,
        bonus: 0,
        bps: 0,
      },
    })),
  }
  const root = document.createElement('div')
  root.innerHTML = renderToStaticMarkup(
    <LeagueTeamVisual
      discovery={discovery}
      leagueId={42}
      entryId={1}
      entryName="Test team"
      manager="Manager"
      shirtCodes={[]}
    />,
  )
  expect(root.querySelector('header > strong')?.textContent).toBe('0 pts')
  expect(root.querySelector('[aria-label="View Player 1 points"] b')?.textContent).toBe('0')
  expect(root.querySelector('[aria-label="View Player 3 points"] b')?.textContent).toBe('-')
})
