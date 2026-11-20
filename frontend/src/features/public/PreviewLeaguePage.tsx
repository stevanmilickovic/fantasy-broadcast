import { ArrowLeft, Play } from 'lucide-react'
import type { Navigate } from '../../app/useBrowserNavigation'
import { LegalFooter } from '../../shared/ui/LegalFooter'
import { PublicHeader } from '../../shared/ui/PublicHeader'
import { LeagueStandingsOverview } from '../leagues/LeagueStandingsOverview'
import { TeamEmblemsContext } from '../leagues/teamEmblems'
import {
  previewLeague,
  previewPlayerDetails,
  previewReplayGameweek,
  previewReplayStandings,
} from './previewLeagueData'
import { WelcomeBroadcastDemo } from './WelcomeBroadcastDemo'
import { welcomeShirtCodes, welcomeTeamEmblems } from './welcomeDemoData'

const emblems = { teams: welcomeTeamEmblems, loading: false, refresh: () => {} }
const leagueName = previewLeague.details.league?.name ?? 'Sunday League Elite'

export function PreviewLeaguePage({ search, navigate }: { search: string; navigate: Navigate }) {
  if (new URLSearchParams(search).get('view') === 'broadcast')
    return (
      <div className="preview-league-replay">
        <WelcomeBroadcastDemo
          replay={{
            gameweek: previewReplayGameweek,
            standings: previewReplayStandings,
            onBack: () => navigate('/preview-league'),
          }}
        />
      </div>
    )

  return (
    <main className="customer-shell preview-league-shell">
      <PublicHeader onNavigate={navigate} />
      <section className="selected-league-page">
        <a className="league-back" href="/">
          <ArrowLeft size={16} aria-hidden="true" /> Home
        </a>
        <header className="league-identity">
          <div>
            <span className="kicker">Preview league</span>
            <h1>{leagueName}</h1>
            <p>Draft · Head-to-head · 4 clubs · Sample results</p>
          </div>
          <button
            type="button"
            className="league-primary"
            onClick={() => {
              navigate('/preview-league?view=broadcast')
              window.scrollTo(0, 0)
            }}
          >
            <Play size={18} aria-hidden="true" /> Watch demo broadcast
          </button>
        </header>
        <TeamEmblemsContext value={emblems}>
          <LeagueStandingsOverview
            leagueName={leagueName}
            discovery={previewLeague}
            scoringType="H2H"
            search={search}
            navigate={navigate}
            sample={{ shirtCodes: welcomeShirtCodes, playerDetails: previewPlayerDetails }}
          />
        </TeamEmblemsContext>
      </section>
      <LegalFooter onNavigate={navigate} className="customer-legal-footer" />
    </main>
  )
}
