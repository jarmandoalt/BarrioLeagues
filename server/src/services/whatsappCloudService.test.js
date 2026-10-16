import assert from 'node:assert/strict'
import test from 'node:test'
import { sendAlertaArbitro } from './whatsappCloudService.js'

test('sendAlertaArbitro prepara correctamente la plantilla con las 9 variables y ADMIN_WHATSAPP_NUMBER', async () => {
  process.env.ADMIN_WHATSAPP_NUMBER = '5214491234567'

  const mockMatch = {
    _id: '67890abcdef1234567890abc',
    idPartido: '112562',
    equipoLocal_id: { nombre: 'Real Papus' },
    equipoVisitante_id: { nombre: 'Los nenes' },
    fecha: new Date(2026, 9, 28), // 28 de Octubre
    hora: '20:00',
    cancha_id: { nombre: 'Cancha 2' },
    arbitro_id: { nombre: 'Leon Martinez', telefono: '4494481016' },
    arbitro_motivo_rechazo: 'No puedo asistir',
  }

  const result = await sendAlertaArbitro(mockMatch, { motivo: 'No puedo asistir' })

  assert.equal(result.success, true)
  assert.equal(result.prepared, true)
  assert.equal(result.adminPhone, '5214491234567')
  assert.deepEqual(result.variables, [
    '112562',
    'Real Papus',
    'Los nenes',
    '28 de octubre',
    '20:00',
    'Cancha 2',
    'Leon Martinez',
    '4494481016',
    'No puedo asistir',
  ])
})
