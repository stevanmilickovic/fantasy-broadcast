import { Bell, ChevronRight, Radio, Sparkles, Trophy, Users, Zap } from 'lucide-react'
import type { Navigate } from '../../app/useBrowserNavigation'
import { PublicHeader } from '../../shared/ui/PublicHeader'
import { WelcomeBroadcastDemo } from './WelcomeBroadcastDemo'

type Props = { onNavigate: Navigate }

export function WelcomePage({ onNavigate }: Props) {
  return (
    <main className="welcome-page">
      <PublicHeader onNavigate={onNavigate} />

      <section className="welcome-hero">
        <div className="welcome-hero-copy">
          <span className="welcome-eyebrow">
            <span /> Live fantasy football, reimagined
          </span>
          <h1>
            Your league.
            <br />
            <em>Live on air.</em>
          </h1>
          <p>
            Turn every Premier League matchday into a live broadcast built around your FPL league.
          </p>
          <div className="welcome-hero-actions">
            <button type="button" onClick={() => onNavigate('/register')}>
              Create your account <ChevronRight size={19} />
            </button>
          </div>
          <small>
            <span>Draft</span>
            <i /> <span>Classic</span>
            <i /> Live scores from FPL data
          </small>
        </div>
        <WelcomeBroadcastDemo />
      </section>

      <section className="welcome-proof" aria-label="Product highlights">
        <p>Matchday is better when the whole league can feel every swing.</p>
        <div>
          <span>
            <Zap size={18} /> Live point events
          </span>
          <span>
            <Trophy size={18} /> League standings
          </span>
          <span>
            <Sparkles size={18} /> Broadcast commentary
          </span>
        </div>
      </section>

      <section className="welcome-features" data-nosnippet="">
        <article>
          <Users size={24} />
          <h3>Bring your league</h3>
          <p>
            Register a league of your own, or create a free account to follow an existing FPL
            league.
          </p>
        </article>
        <article>
          <Radio size={24} />
          <h3>Open the broadcast</h3>
          <p>
            Once the broadcast is live, watch every matchup and scoring swing unfold in real time.
          </p>
        </article>
        <article>
          <Bell size={24} />
          <h3>Feel every turning point</h3>
          <p>
            Watch goals, assists, cards, bonus changes, lead changes, and commentary arrive as the
            action unfolds.
          </p>
        </article>
      </section>

      <section className="welcome-final-cta">
        <div>
          <span className="welcome-eyebrow">Ready for kick-off?</span>
          <h2>
            Bring your league
            <br />
            <em>to life.</em>
          </h2>
        </div>
        <div>
          <p>
            Create a free account, follow your league, and be ready when the next broadcast goes
            live.
          </p>
          <button type="button" onClick={() => onNavigate('/register')}>
            Create a free account <ChevronRight size={19} />
          </button>
          <small>
            Already registered?{' '}
            <button type="button" onClick={() => onNavigate('/login')}>
              Sign in
            </button>
          </small>
        </div>
      </section>

      <footer className="welcome-footer">
        <span>
          <Radio size={18} /> Fantasy Broadcast
        </span>
        <small>
          Live companion for FPL Draft and Classic leagues.{' '}
          <button type="button" onClick={() => onNavigate('/privacy')}>
            Privacy
          </button>{' '}
          ·{' '}
          <button type="button" onClick={() => onNavigate('/terms')}>
            Terms
          </button>{' '}
          ·{' '}
          <button type="button" onClick={() => onNavigate('/refunds')}>
            Refunds
          </button>
        </small>
      </footer>
    </main>
  )
}
