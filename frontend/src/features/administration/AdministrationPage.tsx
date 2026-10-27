import { useState } from 'react'
import { loadLeagueDiscovery, loadMockLeagueDiscovery } from '../../api/fplDiscoveryApi'
import {
  postMockAction,
  startComprehensiveMock,
  startRealBroadcast,
  startTotalPointsMock,
  type FplLeagueType,
  type MockNarrationMode,
} from '../../api/liveApi'
import { AdministrationScreen } from './AdministrationScreen'
import { LegalFooter } from '../../shared/ui/LegalFooter'
import { useLiveState } from '../broadcast/useLiveState'
import { enablePointChangeSound } from '../broadcast/broadcastSound'
import type { LeagueDiscoveryState } from '../../types/fpl'
import type { AuthUser } from '../../types/customer'
import type { Navigate } from '../../app/useBrowserNavigation'

export function AdministrationPage({
  user: authUser,
  navigate,
  signOut,
}: {
  user: AuthUser
  navigate: Navigate
  signOut: () => Promise<void>
}) {
  const [isBusy, setIsBusy] = useState(false)
  const [leagueId, setLeagueId] = useState('49824')
  const [leagueType, setLeagueType] = useState<FplLeagueType>('DRAFT')
  const [leagueDiscovery, setLeagueDiscovery] = useState<LeagueDiscoveryState | null>(null)
  const [mockNarrationMode, setMockNarrationMode] = useState<MockNarrationMode>('NONE')
  const [leagueError, setLeagueError] = useState<string | null>(null)
  const [isLeagueLoading, setIsLeagueLoading] = useState(false)

  const { liveState, error, setLiveState, setError } = useLiveState({ enabled: true })
  const runAction = async (action: 'start' | 'advance' | 'reset') => {
    setIsBusy(true)
    try {
      const nextState = await postMockAction(action)
      setLiveState(nextState)
      if (action === 'start') {
        navigate('/broadcast')
      }
      if (action === 'reset') {
        navigate('/administration')
      }
      setError(null)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unknown request error')
    } finally {
      setIsBusy(false)
    }
  }

  const inspectLeague = async () => {
    const normalizedLeagueId = leagueId.trim()
    if (!normalizedLeagueId) {
      setLeagueError('Enter a league id.')
      return
    }

    if (leagueType === 'CLASSIC') {
      setLeagueDiscovery(null)
      setLeagueError(
        'Classic league discovery is not built yet. Start the live broadcast to record its head-to-head matchups.',
      )
      return
    }

    setIsLeagueLoading(true)
    try {
      const nextDiscovery = await loadLeagueDiscovery(normalizedLeagueId)
      setLeagueDiscovery(nextDiscovery)
      setLeagueError(null)
    } catch (requestError) {
      setLeagueError(
        requestError instanceof Error ? requestError.message : 'Unknown league request error',
      )
    } finally {
      setIsLeagueLoading(false)
    }
  }

  const inspectMockLeague = async () => {
    setIsLeagueLoading(true)
    try {
      const nextDiscovery = await loadMockLeagueDiscovery()
      setLeagueDiscovery(nextDiscovery)
      setLeagueError(null)
      setLeagueId(String(nextDiscovery.details.league?.id ?? leagueId))
    } catch (requestError) {
      setLeagueError(
        requestError instanceof Error ? requestError.message : 'Unknown mock league request error',
      )
    } finally {
      setIsLeagueLoading(false)
    }
  }

  const startLiveBroadcast = async () => {
    const normalizedLeagueId = leagueId.trim()
    if (!normalizedLeagueId) {
      setLeagueError('Enter your league id before starting a live broadcast.')
      return
    }

    enablePointChangeSound()
    setIsBusy(true)
    try {
      const nextState = await startRealBroadcast(normalizedLeagueId, leagueType)
      setLiveState(nextState)
      navigate('/broadcast')
      setError(null)
      setLeagueError(null)
    } catch (requestError) {
      setLeagueError(
        requestError instanceof Error ? requestError.message : 'Unable to start live broadcast.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  const startComprehensiveMockBroadcast = async () => {
    setIsBusy(true)
    try {
      const nextState = await startComprehensiveMock(mockNarrationMode)
      setLiveState(nextState)
      navigate('/broadcast')
      setError(null)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to start comprehensive mock broadcast.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  const startTotalPointsMockBroadcast = async () => {
    setIsBusy(true)
    try {
      const nextState = await startTotalPointsMock(mockNarrationMode)
      setLiveState(nextState)
      navigate('/broadcast')
      setError(null)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to start total-points mock broadcast.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className="administration-page">
      {error && (
        <p className="discovery-error" role="alert">
          {error}
        </p>
      )}
      <AdministrationScreen
        session={{
          user: authUser,
          onOpenLeague: (selectedLeagueId) => navigate(`/league?leagueId=${selectedLeagueId}`),
          onSignOut: () => void signOut(),
        }}
        leagueSetup={{
          leagueId,
          leagueType,
          leagueDiscovery,
          leagueError,
          isLeagueLoading,
          onLeagueIdChange: setLeagueId,
          onLeagueTypeChange: setLeagueType,
          onInspectLeague: () => void inspectLeague(),
          onInspectMockLeague: () => void inspectMockLeague(),
        }}
        broadcastControls={{
          liveState,
          mockNarrationMode,
          isBusy,
          onMockNarrationModeChange: setMockNarrationMode,
          onStartLiveBroadcast: () => void startLiveBroadcast(),
          onStartMockBroadcast: () => void runAction('start'),
          onStartComprehensiveMockBroadcast: () => void startComprehensiveMockBroadcast(),
          onStartTotalPointsMockBroadcast: () => void startTotalPointsMockBroadcast(),
          onShowLiveBroadcast: () => navigate('/broadcast'),
          onAdvanceBroadcast: () => void runAction('advance'),
          onResetBroadcast: () => void runAction('reset'),
        }}
      />
      <LegalFooter onNavigate={navigate} className="administration-legal-footer" />
    </div>
  )
}
