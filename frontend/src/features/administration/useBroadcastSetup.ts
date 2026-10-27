import { useState } from 'react'
import type { Navigate } from '../../app/useBrowserNavigation'
import { useMutation } from '../../shared/api/useMutation'
import type { FplLeagueType, LeagueDiscoveryState } from '../../shared/fpl/types'
import {
  postMockAction,
  startComprehensiveMock,
  startRealBroadcast,
  startTotalPointsMock,
  type MockNarrationMode,
} from '../broadcast/api'
import { enablePointChangeSound } from '../broadcast/broadcastSound'
import type { LiveStateResponse } from '../broadcast/types'
import { useLiveState } from '../broadcast/useLiveState'
import { loadLeagueDiscovery, loadMockLeagueDiscovery } from './discoveryApi'

export function useBroadcastSetup(navigate: Navigate) {
  const [leagueId, setLeagueId] = useState('49824')
  const [leagueType, setLeagueType] = useState<FplLeagueType>('DRAFT')
  const [leagueDiscovery, setLeagueDiscovery] = useState<LeagueDiscoveryState | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [mockNarrationMode, setMockNarrationMode] = useState<MockNarrationMode>('NONE')
  const discovery = useMutation()
  const broadcast = useMutation()
  const { liveState, error, setLiveState } = useLiveState({ enabled: true })
  const inspect = async (mock = false) => {
    setValidationError(null)
    if (!mock && !leagueId.trim()) {
      setValidationError('Enter a league id.')
      return
    }
    if (!mock && leagueType === 'CLASSIC') {
      setLeagueDiscovery(null)
      setValidationError(
        'Classic league discovery is not built yet. Start the live broadcast to record its head-to-head matchups.',
      )
      return
    }
    const result = await discovery.run((signal) =>
      mock ? loadMockLeagueDiscovery(signal) : loadLeagueDiscovery(leagueId.trim(), signal),
    )
    if (result) {
      setLeagueDiscovery(result.data)
      if (mock) setLeagueId(String(result.data.details.league?.id ?? leagueId))
    }
  }
  const start = async (action: (signal: AbortSignal) => Promise<LiveStateResponse>) => {
    const result = await broadcast.run(action)
    if (result) {
      setLiveState(result.data)
      navigate('/broadcast')
    }
  }
  const startLive = async () => {
    setValidationError(null)
    if (!leagueId.trim()) {
      setValidationError('Enter your league id before starting a live broadcast.')
      return
    }
    enablePointChangeSound()
    await start((signal) => startRealBroadcast(leagueId.trim(), leagueType, signal))
  }
  const updateMock = async (action: 'advance' | 'reset') => {
    const result = await broadcast.run((signal) => postMockAction(action, signal))
    if (result) setLiveState(result.data)
  }
  return {
    error: broadcast.error ?? error,
    leagueSetup: {
      leagueId,
      leagueType,
      leagueDiscovery,
      leagueError: validationError ?? discovery.error ?? null,
      isLeagueLoading: discovery.busy,
      onLeagueIdChange: (value: string) => {
        discovery.reset()
        setLeagueDiscovery(null)
        setLeagueId(value)
      },
      onLeagueTypeChange: (value: FplLeagueType) => {
        discovery.reset()
        setLeagueDiscovery(null)
        setLeagueType(value)
      },
      onInspectLeague: () => void inspect(),
      onInspectMockLeague: () => void inspect(true),
    },
    broadcastControls: {
      liveState,
      mockNarrationMode,
      isBusy: broadcast.busy,
      onMockNarrationModeChange: setMockNarrationMode,
      onStartLiveBroadcast: () => void startLive(),
      onStartMockBroadcast: () => void start((signal) => postMockAction('start', signal)),
      onStartComprehensiveMockBroadcast: () =>
        void start((signal) => startComprehensiveMock(mockNarrationMode, signal)),
      onStartTotalPointsMockBroadcast: () =>
        void start((signal) => startTotalPointsMock(mockNarrationMode, signal)),
      onShowLiveBroadcast: () => navigate('/broadcast'),
      onAdvanceBroadcast: () => void updateMock('advance'),
      onResetBroadcast: () => void updateMock('reset'),
    },
  }
}
