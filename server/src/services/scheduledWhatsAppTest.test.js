import assert from 'node:assert/strict'
import test from 'node:test'
import { getDueScheduleDate } from './scheduledWhatsAppTest.js'

const league = { avisoPartidosDia: 'lunes', avisoPartidosHora: '21:10' }

test('detecta la fecha cuando coincide el día y la hora programados', () => {
  assert.equal(getDueScheduleDate(league, new Date(2026, 9, 5, 21, 10)), '2026-10-05')
})

test('no se activa fuera del día u hora configurados', () => {
  assert.equal(getDueScheduleDate(league, new Date(2026, 9, 5, 21, 11)), '')
  assert.equal(getDueScheduleDate(league, new Date(2026, 9, 6, 21, 10)), '')
})