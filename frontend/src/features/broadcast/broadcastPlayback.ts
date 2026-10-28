import type { LiveStateResponse } from './types'

export type PresentationSnapshot = {
  liveState: LiveStateResponse | null
  focusedId: string | null
  eventId: string | null
  showingLeaderboard: boolean
}
export type ScenePhase = 'idle' | 'covering' | 'preparing'
export type PresentationState = {
  snapshot: PresentationSnapshot
  pending: PresentationSnapshot | null
  phase: ScenePhase
  transitionId: number
  revealIndex: number
}
type PresentationAction =
  | { type: 'receive'; snapshot: PresentationSnapshot; manual: boolean }
  | { type: 'covered'; id: number }
  | { type: 'settled'; id: number }

export const initialPresentationState: PresentationState = {
  snapshot: { liveState: null, focusedId: null, eventId: null, showingLeaderboard: false },
  pending: null,
  phase: 'idle',
  transitionId: 0,
  revealIndex: 0,
}
const sameScene = (a: PresentationSnapshot, b: PresentationSnapshot) =>
  ((a.showingLeaderboard && b.showingLeaderboard) || a.focusedId === b.focusedId) &&
  a.showingLeaderboard === b.showingLeaderboard &&
  Boolean(a.liveState?.matchups.length) === Boolean(b.liveState?.matchups.length)

export function presentationReducer(
  state: PresentationState,
  action: PresentationAction,
): PresentationState {
  if (action.type === 'receive') {
    if (action.manual)
      return {
        snapshot: action.snapshot,
        pending: null,
        phase: 'idle',
        transitionId: state.transitionId + 1,
        revealIndex: state.revealIndex,
      }
    if (state.phase !== 'idle') return state
    if (!action.snapshot.liveState || !action.snapshot.focusedId)
      return { ...state, snapshot: action.snapshot }
    if (!state.snapshot.liveState)
      return {
        snapshot: action.snapshot,
        pending: null,
        phase: 'preparing',
        transitionId: state.transitionId + 1,
        revealIndex: state.revealIndex + 1,
      }
    if (sameScene(state.snapshot, action.snapshot)) return { ...state, snapshot: action.snapshot }
    return {
      ...state,
      pending: action.snapshot,
      phase: 'covering',
      transitionId: state.transitionId + 1,
      revealIndex: state.revealIndex + 1,
    }
  }
  if (action.id !== state.transitionId) return state
  if (action.type === 'covered' && state.phase === 'covering' && state.pending)
    return { ...state, snapshot: state.pending, pending: null, phase: 'preparing' }
  if (action.type === 'settled')
    return { ...state, snapshot: state.pending ?? state.snapshot, pending: null, phase: 'idle' }
  return state
}
