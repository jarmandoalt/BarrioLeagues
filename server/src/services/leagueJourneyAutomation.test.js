import assert from 'node:assert/strict'
import test from 'node:test'
import { getDueJourneyNumber } from './leagueJourneyAutomation.js'

const journeyDates = [
  { jornada: 1, fecha: '2026-10-24' },
  { jornada: 2, fecha: '2026-10-26' },
  { jornada: 3, fecha: '2026-11-02' },
]

test('no avanza antes de la fecha programada para la siguiente jornada', () => {
  assert.equal(getDueJourneyNumber(journeyDates, new Date('2026-10-25T18:00:00Z')), 1)
})

test('avanza a la jornada cuya fecha programada ya llegó', () => {
  assert.equal(getDueJourneyNumber(journeyDates, new Date('2026-10-27T18:00:00Z')), 2)
})

test('recupera varias jornadas vencidas y omite fechas inválidas', () => {
  assert.equal(getDueJourneyNumber([
    null,
    ...journeyDates,
    { jornada: 4, fecha: 'fecha-inválida' },
  ], new Date('2026-11-10T18:00:00Z')), 3)
})

test('sin fechas válidas no programa un avance', () => {
  assert.equal(getDueJourneyNumber([], new Date('2026-10-27T18:00:00Z')), 0)
  assert.equal(getDueJourneyNumber(journeyDates, new Date('fecha-inválida')), 0)
})
