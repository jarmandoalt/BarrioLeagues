import assert from 'node:assert/strict'
import test from 'node:test'
import { getRefereeConfirmationTimeoutMs, isRefereeNoticeTime } from './scheduleNotificationService.js'

test('el plazo para confirmar al árbitro es de 6 minutos en pruebas y 6 horas en producción', () => {
  const previousMode = process.env.TEST_MODE
  try {
    process.env.TEST_MODE = 'true'
    assert.equal(getRefereeConfirmationTimeoutMs(), 6 * 60 * 1000)

    process.env.TEST_MODE = 'false'
    assert.equal(getRefereeConfirmationTimeoutMs(), 6 * 60 * 60 * 1000)
  } finally {
    if (previousMode === undefined) delete process.env.TEST_MODE
    else process.env.TEST_MODE = previousMode
  }
})

test('el aviso se evalúa con el día y hora configurados para la liga', () => {
  const configuredLeague = { avisoPartidosDia: 'martes', avisoPartidosHora: '09:00' }
  assert.equal(isRefereeNoticeTime(configuredLeague, new Date(2026, 9, 20, 9, 0)), true)
  assert.equal(isRefereeNoticeTime(configuredLeague, new Date(2026, 9, 20, 9, 1)), false)
})
