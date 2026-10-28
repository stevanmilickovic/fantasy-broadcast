import { expect, it } from 'vitest'
import { welcomeBroadcastState } from '../public/welcomeDemoData'
import { stageTotalPointsState } from './broadcastPlayback'

it('freezes the outgoing total-points club while keeping the incoming club and its events current', () => {
  const previous = welcomeBroadcastState(0)
  const incoming = welcomeBroadcastState(1)
  previous.matchups = []
  incoming.matchups = []
  const outgoingId = previous.teams[0].managerId
  const incomingId = incoming.events[0].managerId
  const staged = stageTotalPointsState(incoming, previous, incomingId, outgoingId, true)
  expect(staged?.teams.find((team) => team.managerId === outgoingId)).toBe(previous.teams[0])
  expect(staged?.teams.find((team) => team.managerId === incomingId)).toBe(
    incoming.teams.find((team) => team.managerId === incomingId),
  )
  expect(staged?.events[0]).toBe(incoming.events[0])
  expect(previous.events).toHaveLength(1)
})

it('lets an active notification update the club already on screen', () => {
  const previous = welcomeBroadcastState(0)
  const incoming = welcomeBroadcastState(2)
  const focusId = incoming.events[0].managerId
  expect(stageTotalPointsState(incoming, previous, focusId, focusId, true)).toBe(incoming)
})
