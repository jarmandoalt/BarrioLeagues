import { normalizeContactPhone } from '../utils/normalizeContactPhone.js'
import dayjs from 'dayjs'
import 'dayjs/locale/es.js'
import { NotificationLog } from '../models/NotificationLog.js'
import mongoose from 'mongoose'

dayjs.locale('es')

const getCloudConfig = () => ({
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  graphApiVersion: process.env.WHATSAPP_GRAPH_API_VERSION || 'v23.0',
  templateName: process.env.WHATSAPP_MATCH_TEMPLATE_NAME,
  templateLanguage: process.env.WHATSAPP_MATCH_TEMPLATE_LANGUAGE || 'es_MX',
})

export const getMissingWhatsAppConfig = () => {
  const config = getCloudConfig()
  return [
    ['WHATSAPP_ACCESS_TOKEN', config.accessToken],
    ['WHATSAPP_PHONE_NUMBER_ID', config.phoneNumberId],
    ['WHATSAPP_MATCH_TEMPLATE_NAME', config.templateName],
  ].filter(([, value]) => !value).map(([name]) => name)
}

export const normalizeWhatsAppPhone = normalizeContactPhone

export const sendMatchTemplate = async ({ phoneNumber, recipientName, localTeam, visitorTeam, date, time, court, leagueName, jornada }) => {
  const config = getCloudConfig()
  const missingConfig = getMissingWhatsAppConfig()
  if (missingConfig.length) throw new Error(`Falta configurar: ${missingConfig.join(', ')}`)

  const normalizedPhone = normalizeWhatsAppPhone(phoneNumber)
  if (!/^\d{8,15}$/.test(normalizedPhone)) {
    throw new Error('El teléfono debe incluir el código de país y tener entre 8 y 15 dígitos')
  }

  const authHeader = `Bearer ` + config.accessToken
  const response = await fetch(`https://graph.facebook.com/` + config.graphApiVersion + `/` + config.phoneNumberId + `/messages`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: normalizedPhone,
      type: 'template',
      template: {
        name: config.templateName,
        language: { code: config.templateLanguage },
        components: [{
          type: 'body',
          parameters: [recipientName, localTeam, visitorTeam, date, time, court, leagueName, String(jornada)]
            .map((text) => ({ type: 'text', text: String(text || '-') })),
        }],
      },
    }),
  })

  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(result.error?.message || `WhatsApp Cloud API respondió HTTP ` + response.status)
  }

  return { messageId: result.messages?.[0]?.id || null, status: result.messages?.[0]?.message_status || 'accepted' }
}

export const sendRefereeTemplateWithButtons = async ({ 
  phoneNumber, 
  refereeName, 
  leagueName, 
  jornada, 
  fecha, 
  hora, 
  cancha, 
  equipoLocal, 
  equipoVisitante, 
  idPartido, 
  adminName,
  matchId = 'test' 
}) => {
  const config = getCloudConfig()
  
  const normalizedPhone = normalizeWhatsAppPhone(phoneNumber)
  if (!/^\d{8,15}$/.test(normalizedPhone)) {
    throw new Error('El teléfono debe incluir el código de país y tener entre 8 y 15 dígitos')
  }

  const validMatchId = String(matchId || 'test')
  const authHeader = `Bearer ` + config.accessToken
  const response = await fetch(`https://graph.facebook.com/` + config.graphApiVersion + `/` + config.phoneNumberId + `/messages`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: normalizedPhone,
      type: 'template',
      template: {
        name: 'plantilla_arbitro',
        language: { code: 'es_MX' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: refereeName },
              { type: 'text', text: leagueName },
              { type: 'text', text: String(jornada) },
              { type: 'text', text: fecha },
              { type: 'text', text: hora },
              { type: 'text', text: cancha },
              { type: 'text', text: equipoLocal },
              { type: 'text', text: equipoVisitante },
              { type: 'text', text: idPartido },
              { type: 'text', text: adminName },
            ],
          },
          {
            type: 'button',
            sub_type: 'quick_reply',
            index: '0',
            parameters: [
              { type: 'payload', payload: `confirm_yes_` + validMatchId },
            ],
          },
          {
            type: 'button',
            sub_type: 'quick_reply',
            index: '1',
            parameters: [
              { type: 'payload', payload: `confirm_no_` + validMatchId },
            ],
          },
        ],
      },
    }),
  })

  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(result.error?.message || `WhatsApp Cloud API respondió HTTP ` + response.status)
  }

  return { messageId: result.messages?.[0]?.id || null, status: result.messages?.[0]?.message_status || 'accepted' }
}

export const sendAlertaArbitro = async (match, options = {}) => {
  const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER || process.env.WHATSAPP_SCHEDULED_TEST_PHONE || 'admin'
  const normalizedAdminPhone = normalizeWhatsAppPhone(adminPhone)

  const idPartido = match.idPartido || '-'
  const equipoLocal = match.equipoLocal_id?.nombre || 'Equipo Local'
  const equipoVisitante = match.equipoVisitante_id?.nombre || 'Equipo Visitante'
  const fecha = match.fecha ? dayjs(match.fecha).locale('es').format('DD [de] MMMM') : 'Fecha por confirmar'
  const hora = match.hora || 'Hora por confirmar'
  const cancha = match.cancha_id?.nombre || 'Cancha por confirmar'
  const nombreArbitro = match.arbitro_id?.nombre || 'Árbitro'
  const telArbitro = match.arbitro_id?.telefono || 'Sin teléfono'
  const motivo = options.motivo || match.arbitro_motivo_rechazo || 'No puedo asistir'

  const variables = [
    String(idPartido),
    String(equipoLocal),
    String(equipoVisitante),
    String(fecha),
    String(hora),
    String(cancha),
    String(nombreArbitro),
    String(telArbitro),
    String(motivo),
  ]

  console.log(`[WhatsApp] 🚨 [PREPARADA] sendAlertaArbitro (Plantilla: alerta_arbitro) para ADMIN_WHATSAPP_NUMBER (${adminPhone} -> ${normalizedAdminPhone}):`)
  variables.forEach((v, idx) => {
    console.log(`  {{${idx + 1}}} = ${v}`)
  })

  let log = null
  if (mongoose.connection.readyState === 1) {
    try {
      log = await NotificationLog.create({
        match_id: match._id,
        to: adminPhone,
        recipient_name: 'Administrador',
        role: 'admin',
        type: 'referee_rejection',
        message: `[ALERTA_ARBITRO] Partido ${idPartido}: Árbitro ${nombreArbitro} (${telArbitro}) no disponible. Motivo: ${motivo}`,
        status: 'simulated',
        metadata: {
          template: 'alerta_arbitro',
          variables,
          idPartido,
          match_date: match.fecha,
          match_time: match.hora,
          referee_name: nombreArbitro,
          referee_phone: telArbitro,
          motivo,
        },
      })
    } catch (err) {
      console.error(`[WhatsApp] Error registrando log para sendAlertaArbitro:`, err.message)
    }
  }

  // Aún NO la envíes, solo déjala preparada con logs y usando ADMIN_WHATSAPP_NUMBER del .env
  return {
    success: true,
    prepared: true,
    adminPhone,
    variables,
    logId: log?._id || null,
  }
}
