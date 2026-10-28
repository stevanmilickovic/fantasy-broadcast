import type { LiveStateResponse, LiveStandingView } from './types'

export const stageTotalPointsState = (
  incomingState: LiveStateResponse | null,
  displayedState: LiveStateResponse | null,
  focusedId: string | null,
  displayedFocusId: string | null,
  isNotificationActive: boolean,
) => {
  if (!incomingState || !displayedState || !focusedId || !displayedFocusId) return incomingState
  if (focusedId === displayedFocusId) return incomingState
  const displayedEventIds = new Set((displayedState.events ?? []).map((event) => event.id))
  const hasIncomingEvent = (incomingState.events ?? []).some(
    (event) => !displayedEventIds.has(event.id),
  )
  if (!isNotificationActive && !hasIncomingEvent) return incomingState
  const displayedTeam = (displayedState.teams ?? []).find(
    (team) => team.managerId === displayedFocusId,
  )
  if (!displayedTeam) return incomingState

  const focusedEvents = (incomingState.events ?? []).filter(
    (event) => event.managerId === focusedId,
  )
  const stagedEvents = [
    ...focusedEvents,
    ...(displayedState.events ?? []).filter(
      (event) => !focusedEvents.some((focusedEvent) => focusedEvent.id === event.id),
    ),
  ]
  const stagedStandings = displayedState.standings ?? []

  return {
    ...incomingState,
    teams: (incomingState.teams ?? []).map((team) =>
      team.managerId === displayedFocusId ? displayedTeam : team,
    ),
    standings: (incomingState.standings ?? []).map((standing) =>
      standing.teamId === displayedFocusId
        ? (stagedStandings.find((candidate) => candidate.teamId === displayedFocusId) ?? standing)
        : standing,
    ),
    events: stagedEvents,
  }
}

export type PresentationState = {
  liveState: LiveStateResponse | null
  standings: LiveStandingView[] | null
  displayedFocusId: string | null
  transitioningToMatch: boolean
  revealingMatch: boolean
  visibleEventId: string | null
  holdingPendingUpdates: boolean
  displayingLeaderboard: boolean
}

export type PresentationSnapshot = {
  liveState: LiveStateResponse | null
  focusedId: string | null
  eventId: string | null
  showingLeaderboard: boolean
}

type PresentationAction =
  | { type: 'sync'; snapshot: PresentationSnapshot }
  | { type: 'first-focus'; snapshot: PresentationSnapshot }
  | { type: 'start-transition' }
  | { type: 'swap'; snapshot: PresentationSnapshot }
  | { type: 'start-reveal' }
  | { type: 'finish-reveal'; snapshot: PresentationSnapshot }
  | { type: 'finish-transition' }
  | { type: 'hide-leaderboard' }

export const initialPresentationState: PresentationState = {
  liveState: null,
  standings: null,
  displayedFocusId: null,
  transitioningToMatch: false,
  revealingMatch: false,
  visibleEventId: null,
  holdingPendingUpdates: false,
  displayingLeaderboard: false,
}

const synchronizedState = (snapshot: PresentationSnapshot): PresentationState => ({
  ...initialPresentationState,
  liveState: snapshot.liveState,
  standings: snapshot.liveState?.standings ?? null,
  displayedFocusId: snapshot.focusedId,
  visibleEventId: snapshot.eventId,
  displayingLeaderboard: snapshot.showingLeaderboard,
})

export function presentationReducer(
  state: PresentationState,
  action: PresentationAction,
): PresentationState {
  switch (action.type) {
    case 'sync':
      return {
        ...state,
        liveState: action.snapshot.liveState,
        standings: action.snapshot.liveState?.standings ?? null,
        displayedFocusId: action.snapshot.focusedId,
        transitioningToMatch: false,
        revealingMatch: false,
        visibleEventId: action.snapshot.eventId,
        holdingPendingUpdates: false,
        displayingLeaderboard: action.snapshot.showingLeaderboard,
      }
    case 'first-focus':
      return {
        ...synchronizedState(action.snapshot),
        visibleEventId: null,
        holdingPendingUpdates: true,
      }
    case 'start-transition':
      return {
        ...state,
        visibleEventId: null,
        holdingPendingUpdates: false,
        transitioningToMatch: true,
        revealingMatch: false,
      }
    case 'swap':
      return {
        ...state,
        liveState: action.snapshot.liveState,
        standings: action.snapshot.liveState?.standings ?? null,
        displayedFocusId: action.snapshot.focusedId,
        displayingLeaderboard: action.snapshot.showingLeaderboard,
        holdingPendingUpdates: true,
      }
    case 'start-reveal':
      return { ...state, revealingMatch: true }
    case 'finish-reveal':
      return {
        ...state,
        revealingMatch: false,
        visibleEventId: action.snapshot.eventId,
        holdingPendingUpdates: false,
        standings: action.snapshot.liveState?.standings ?? null,
      }
    case 'finish-transition':
      return { ...state, transitioningToMatch: false }
    case 'hide-leaderboard':
      return { ...state, displayingLeaderboard: false }
  }
}
