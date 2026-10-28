import { expect, it } from 'vitest'
import { welcomeBroadcastState } from '../public/welcomeDemoData'
import { initialPresentationState, presentationReducer } from './broadcastPlayback'

it('a manual selection invalidates a pending cover so late animation completions cannot replace it', () => {
  const first = {
    liveState: welcomeBroadcastState(0),
    focusedId: 'match-one',
    eventId: 'first',
    showingLeaderboard: false,
  }
  const next = { ...first, liveState: welcomeBroadcastState(1), focusedId: 'match-two' }
  let state = presentationReducer(initialPresentationState, {
    type: 'receive',
    snapshot: first,
    manual: true,
  })
  state = presentationReducer(state, { type: 'receive', snapshot: next, manual: false })
  const cover = state.transitionId
  expect(state.phase).toBe('covering')
  state = presentationReducer(state, { type: 'receive', snapshot: first, manual: true })
  expect(presentationReducer(state, { type: 'covered', id: cover })).toBe(state)
  expect(presentationReducer(state, { type: 'settled', id: cover })).toBe(state)
  expect(state.snapshot).toBe(first)
})

it('updates a visible leaderboard without replaying its intro when the automatic focus changes', () => {
  const snapshot = {
    liveState: welcomeBroadcastState(0),
    focusedId: 'match-one',
    eventId: null,
    showingLeaderboard: true,
  }
  const state = presentationReducer(initialPresentationState, {
    type: 'receive',
    snapshot,
    manual: true,
  })
  const next = presentationReducer(state, {
    type: 'receive',
    snapshot: { ...snapshot, focusedId: 'match-two' },
    manual: false,
  })
  expect(next.phase).toBe('idle')
  expect(next.transitionId).toBe(state.transitionId)
})

it('alternates automatic reveal titles independently of manual selections', () => {
  const first = {
    liveState: welcomeBroadcastState(0),
    focusedId: 'match-one',
    eventId: null,
    showingLeaderboard: false,
  }
  let state = presentationReducer(initialPresentationState, {
    type: 'receive',
    snapshot: first,
    manual: false,
  })
  expect(state.revealIndex).toBe(1)
  state = presentationReducer(state, { type: 'settled', id: state.transitionId })
  state = presentationReducer(state, { type: 'receive', snapshot: first, manual: true })
  expect(state.revealIndex).toBe(1)
  state = presentationReducer(state, {
    type: 'receive',
    snapshot: { ...first, focusedId: 'match-two' },
    manual: false,
  })
  expect(state.revealIndex).toBe(2)
})
