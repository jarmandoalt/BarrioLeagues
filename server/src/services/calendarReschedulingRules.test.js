import test from 'node:test'
import assert from 'node:assert/strict'
import { findScheduleConflicts, isCourtBlocked, isRefereeBusyAt } from './calendarReschedulingRules.js'

test('a court is blocked for less than two hours, but not at the two-hour boundary', () => {
  const start = new Date('2026-10-24T18:00:00.000Z')
  assert.equal(isCourtBlocked(start, new Date('2026-10-24T19:59:00.000Z')), true)
  assert.equal(isCourtBlocked(start, new Date('2026-10-24T20:00:00.000Z')), false)
})

test('a referee is busy only at the exact start time', () => {
  assert.equal(isRefereeBusyAt('2026-10-24T18:00:00.000Z', '2026-10-24T18:00:00.000Z'), true)
  assert.equal(isRefereeBusyAt('2026-10-24T18:00:00.000Z', '2026-10-24T19:00:00.000Z'), false)
})

test('schedule validation detects court and referee collisions in the projected jornada', () => {
  const matches = [
    { _id: 'first', fecha: new Date('2026-10-24T18:00:00.000Z'), cancha_id: 'court-1', arbitro_id: 'ref-1' },
    { _id: 'second', fecha: new Date('2026-10-24T19:00:00.000Z'), cancha_id: 'court-2', arbitro_id: 'ref-2' },
  ]
  const changes = new Map([
    ['second', { fecha: new Date('2026-10-24T18:00:00.000Z'), cancha_id: 'court-1', arbitro_id: 'ref-1' }],
  ])
  assert.deepEqual(
    findScheduleConflicts(matches, changes).map((conflict) => conflict.type).sort(),
    ['arbitro', 'cancha'],
  )
})

test('suspended matches do not block projected court or referee assignments', () => {
  const matches = [
    { _id: 'suspended', estado: 'suspendido', fecha: new Date('2026-10-24T18:00:00.000Z'), cancha_id: 'court-1', arbitro_id: 'ref-1' },
    { _id: 'moved', fecha: new Date('2026-10-24T19:00:00.000Z'), cancha_id: 'court-2', arbitro_id: 'ref-2' },
  ]
  const changes = new Map([
    ['moved', { fecha: new Date('2026-10-24T18:00:00.000Z'), cancha_id: 'court-1', arbitro_id: 'ref-1' }],
  ])
  assert.deepEqual(findScheduleConflicts(matches, changes), [])
})
