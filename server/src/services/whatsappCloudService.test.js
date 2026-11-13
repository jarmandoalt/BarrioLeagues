import assert from 'node:assert/strict'
import test from 'node:test'
import { sendAlertaArbitro, sendMatchTemplate, sendRefereeTemplateWithButtons } from './whatsappCloudService.js'

const withEnvironment = async (values, run) => {
  const previousValues = new Map(Object.keys(values).map((key) => [key, process.env[key]]))
  const originalFetch = globalThis.fetch

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }

  try {
    await run()
  } finally {
    for (const [key, value] of previousValues) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    globalThis.fetch = originalFetch
  }
}

const mockMatch = {
  _id: '67890abcdef1234567890abc',
  idPartido: '112562',
  equipoLocal_id: { nombre: 'Real Papus' },
  equipoVisitante_id: { nombre: 'Los nenes' },
  fecha: new Date(2026, 9, 28),
  hora: '20:00',
  cancha_id: { nombre: 'Cancha 2' },
  arbitro_id: { nombre: 'Leon Martinez', telefono: '4494481016' },
  arbitro_motivo_respuesta: 'No puedo asistir',
}

test('sendAlertaArbitro simula el aviso y prepara sus 9 variables', async () => {
  await withEnvironment({
    TEST_MODE: 'true',
    ADMIN_WHATSAPP_NUMBER: '5214491234567',
    WHATSAPP_SCHEDULED_TEST_PHONE: undefined,
  }, async () => {
    const result = await sendAlertaArbitro(mockMatch, { motivo: 'No puedo asistir' })

    assert.equal(result.success, true)
    assert.equal(result.status, 'simulated')
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
})

test('sendAlertaArbitro permite envío explícito en TEST_MODE y usa la plantilla alerta_arbitro', async () => {
  await withEnvironment({
    TEST_MODE: 'true',
    WHATSAPP_ACCESS_TOKEN: 'test-token',
    WHATSAPP_PHONE_NUMBER_ID: '123456',
    WHATSAPP_GRAPH_API_VERSION: 'v23.0',
  }, async () => {
    let request
    globalThis.fetch = async (url, options) => {
      request = { url, options }
      return {
        ok: true,
        json: async () => ({ messages: [{ id: 'wamid.test' }] }),
      }
    }

    const result = await sendAlertaArbitro(mockMatch, {
      adminPhone: '+5214494481016',
      motivo: 'No puedo asistir',
      sendWhatsApp: true,
    })

    const body = JSON.parse(request.options.body)
    assert.equal(result.status, 'sent')
    assert.equal(result.adminPhone, '5214494481016')
    assert.equal(body.to, '5214494481016')
    assert.equal(body.template.name, 'alerta_arbitro')
    assert.equal(body.template.components[0].parameters.length, 9)
  })
})

test('sendRefereeTemplateWithButtons envía botones con un identificador de prueba', async () => {
  await withEnvironment({
    TEST_MODE: 'true',
    WHATSAPP_ACCESS_TOKEN: 'test-token',
    WHATSAPP_PHONE_NUMBER_ID: '123456',
  }, async () => {
    let request
    globalThis.fetch = async (url, options) => {
      request = { url, options }
      return {
        ok: true,
        json: async () => ({ messages: [{ id: 'wamid.test' }] }),
      }
    }

    await sendRefereeTemplateWithButtons({
      phoneNumber: '+5214494481016',
      refereeName: 'Árbitro de prueba',
      leagueName: 'Liga de prueba',
      jornada: 1,
      fecha: '24/10/2026',
      hora: '18:00',
      cancha: 'Cancha de prueba',
      equipoLocal: 'Equipo local',
      equipoVisitante: 'Equipo visitante',
      idPartido: '000001',
      adminName: 'Admin de prueba',
      matchId: 'test-only-id',
    })

    const body = JSON.parse(request.options.body)
    assert.equal(body.to, '5214494481016')
    assert.equal(body.template.name, 'plantilla_arbitro')
    assert.equal(body.template.components[1].parameters[0].payload, 'confirm_yes_test-only-id')
    assert.equal(body.template.components[2].parameters[0].payload, 'confirm_no_test-only-id')
  })
})

test('sendMatchTemplate permite elegir aviso_partido_jornada explícitamente', async () => {
  await withEnvironment({
    TEST_MODE: 'true',
    WHATSAPP_ACCESS_TOKEN: 'test-token',
    WHATSAPP_PHONE_NUMBER_ID: '123456',
    WHATSAPP_MATCH_TEMPLATE_NAME: 'plantilla_anterior',
  }, async () => {
    let request
    globalThis.fetch = async (url, options) => {
      request = { url, options }
      return {
        ok: true,
        json: async () => ({ messages: [{ id: 'wamid.test' }] }),
      }
    }

    await sendMatchTemplate({
      phoneNumber: '4494481016',
      recipientName: 'Capitán de prueba',
      localTeam: 'Equipo local',
      visitorTeam: 'Equipo visitante',
      date: '24/10/2026',
      time: '18:00',
      court: 'Cancha de prueba',
      leagueName: 'Liga de prueba',
      jornada: 1,
      templateName: 'aviso_partido_jornada',
    })

    const body = JSON.parse(request.options.body)
    assert.equal(body.template.name, 'aviso_partido_jornada')
    assert.equal(body.template.components[0].parameters.length, 8)
    assert.equal(body.to, '5214494481016')
  })
})

test('sendMatchTemplate permite enviar la confirmación del árbitro con los cinco datos del partido', async () => {
  await withEnvironment({
    WHATSAPP_ACCESS_TOKEN: 'test-token',
    WHATSAPP_PHONE_NUMBER_ID: '123456',
    WHATSAPP_MATCH_TEMPLATE_NAME: undefined,
  }, async () => {
    let request
    globalThis.fetch = async (url, options) => {
      request = { url, options }
      return {
        ok: true,
        json: async () => ({ messages: [{ id: 'wamid.test' }] }),
      }
    }

    await sendMatchTemplate({
      phoneNumber: '4494481016',
      templateName: 'aviso_partido_jornada',
      templateParameters: ['112562', 'Árbitro de prueba', '28 de octubre', '18:00', 'Cancha 2'],
    })

    const body = JSON.parse(request.options.body)
    assert.equal(body.template.name, 'aviso_partido_jornada')
    assert.deepEqual(
      body.template.components[0].parameters.map(({ text }) => text),
      ['112562', 'Árbitro de prueba', '28 de octubre', '18:00', 'Cancha 2'],
    )
  })
})
