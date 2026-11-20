import {
  Activity,
  Database,
  FlaskConical,
  Radio,
  RotateCcw,
  Search,
  SkipForward,
} from 'lucide-react'
import type { FplLeagueType, LeagueDiscoveryState } from '../../shared/fpl/types'
import type { AuthUser } from '../auth/types'
import type { MockNarrationMode } from '../broadcast/api'
import type { LiveStateResponse } from '../broadcast/types'
import { AdminLeagueRegistry } from './AdminLeagueRegistry'
import { BroadcastScheduleManager } from './BroadcastScheduleManager'
import { LeagueDiscoverySummary } from './LeagueDiscoverySummary'
import { UserAdministration } from './UserAdministration'
import { BillingRefunds } from './BillingRefunds'

type AdministrationSession = {
  user: AuthUser
  onOpenLeague: (leagueId: number) => void
  onSignOut: () => void
}

type LeagueSetup = {
  leagueId: string
  leagueType: FplLeagueType
  leagueDiscovery: LeagueDiscoveryState | null
  leagueError: string | null
  isLeagueLoading: boolean
  onLeagueIdChange: (leagueId: string) => void
  onLeagueTypeChange: (leagueType: FplLeagueType) => void
  onInspectLeague: () => void
  onInspectMockLeague: () => void
}

type BroadcastControls = {
  liveState: LiveStateResponse | null
  mockNarrationMode: MockNarrationMode
  isBusy: boolean
  onMockNarrationModeChange: (mode: MockNarrationMode) => void
  onStartLiveBroadcast: () => void
  onStartMockBroadcast: () => void
  onStartComprehensiveMockBroadcast: () => void
  onStartTotalPointsMockBroadcast: () => void
  onShowLiveBroadcast: () => void
  onAdvanceBroadcast: () => void
  onResetBroadcast: () => void
}

type AdministrationScreenProps = {
  session: AdministrationSession
  leagueSetup: LeagueSetup
  broadcastControls: BroadcastControls
}

export function AdministrationScreen({
  session,
  leagueSetup,
  broadcastControls,
}: AdministrationScreenProps) {
  const { user, onOpenLeague, onSignOut } = session
  const {
    leagueId,
    leagueType,
    leagueDiscovery,
    leagueError,
    isLeagueLoading,
    onLeagueIdChange,
    onLeagueTypeChange,
    onInspectLeague,
    onInspectMockLeague,
  } = leagueSetup
  const {
    liveState,
    mockNarrationMode,
    isBusy,
    onMockNarrationModeChange,
    onStartLiveBroadcast,
    onStartMockBroadcast,
    onStartComprehensiveMockBroadcast,
    onStartTotalPointsMockBroadcast,
    onShowLiveBroadcast,
    onAdvanceBroadcast,
    onResetBroadcast,
  } = broadcastControls
  return (
    <main className="broadcast-shell administration-shell">
      <header className="broadcast-header administration-header">
        <div>
          <span className="kicker">
            <Radio size={16} />
            Gameweek {liveState?.gameweek ?? '—'}
          </span>
          <h1>Fantasy Broadcast Administration</h1>
        </div>
        <div className="account-nav administration-account-nav">
          <span>Administrator · {user.email}</span>
          <a href="/account">Account settings</a>
          <a href="/account/subscriptions">Subscriptions</a>
          <button className="secondary-action" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <AdminLeagueRegistry onOpenLeague={onOpenLeague} />
      <BillingRefunds />
      <BroadcastScheduleManager />
      <UserAdministration currentUserId={user.id} />

      <section className="league-discovery administration-card" aria-label="FPL league setup">
        <div className="discovery-form">
          <div>
            <span className="kicker">
              <Database size={16} />
              FPL league setup
            </span>
            <h2>League Data Check</h2>
          </div>
          <form
            className="administration-check-form"
            onSubmit={(event) => {
              event.preventDefault()
              onInspectLeague()
            }}
          >
            <div className="administration-form-field">
              <label htmlFor="league-id">League ID</label>
              <input
                id="league-id"
                inputMode="numeric"
                value={leagueId}
                onChange={(event) => onLeagueIdChange(event.target.value)}
                placeholder="49824"
              />
            </div>
            <div className="administration-form-field">
              <label htmlFor="league-type">League type</label>
              <select
                id="league-type"
                className="administration-select"
                value={leagueType}
                onChange={(event) => onLeagueTypeChange(event.target.value as FplLeagueType)}
              >
                <option value="DRAFT">Draft</option>
                <option value="CLASSIC">Classic</option>
              </select>
            </div>
            <div className="administration-form-actions">
              <button type="submit" disabled={isLeagueLoading}>
                <Search size={18} />
                Load
              </button>
              <button
                type="button"
                className="secondary-action"
                disabled={isLeagueLoading}
                onClick={onInspectMockLeague}
              >
                <FlaskConical size={18} />
                Test
              </button>
            </div>
          </form>
        </div>
        {leagueType === 'CLASSIC' && (
          <p className="discovery-error">
            Classic league discovery is not built yet; live head-to-head recording is available.
          </p>
        )}
        {leagueError && <p className="discovery-error">{leagueError}</p>}
        {leagueDiscovery && <LeagueDiscoverySummary discovery={leagueDiscovery} />}
      </section>

      <section className="controls-row administration-controls" aria-label="Broadcast controls">
        <label className="administration-form-field">
          <span>Mock narration</span>
          <select
            className="administration-select"
            value={mockNarrationMode}
            onChange={(event) => onMockNarrationModeChange(event.target.value as MockNarrationMode)}
          >
            <option value="NONE">None</option>
            <option value="TEXT">Text</option>
            <option value="VOICE">Voice</option>
          </select>
        </label>
        <button type="button" onClick={onStartLiveBroadcast} disabled={isBusy || isLeagueLoading}>
          <Radio size={18} />
          Start live broadcast
        </button>
        <button type="button" onClick={onStartMockBroadcast} disabled={isBusy}>
          <Activity size={18} />
          Start mock broadcast
        </button>
        <button type="button" onClick={onStartComprehensiveMockBroadcast} disabled={isBusy}>
          <FlaskConical size={18} />
          Start comprehensive test
        </button>
        <button type="button" onClick={onStartTotalPointsMockBroadcast} disabled={isBusy}>
          <FlaskConical size={18} />
          Start total-points test
        </button>
        {liveState?.sequence.started && !liveState?.sequence.complete && (
          <button type="button" onClick={onShowLiveBroadcast} disabled={isBusy}>
            <Radio size={18} />
            Live
          </button>
        )}
        <button
          type="button"
          onClick={onAdvanceBroadcast}
          disabled={isBusy || !liveState || liveState.sequence.complete}
        >
          <SkipForward size={18} />
          Advance
        </button>
        <button type="button" onClick={onResetBroadcast} disabled={isBusy}>
          <RotateCcw size={18} />
          Reset
        </button>
      </section>
    </main>
  )
}
