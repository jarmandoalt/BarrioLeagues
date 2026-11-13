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

export const getMissingWhatsAppApiConfig = () => [
  ['WHATSAPP_ACCESS_TOKEN', process.env.WHATSAPP_ACCESS_TOKEN],
  ['WHATSAPP_PHONE_NUMBER_ID', process.env.WHATSAPP_PHONE_NUMBER_ID],
].filter(([, value]) => !value).map(([name]) => name)

export const normalizeWhatsAppPhone = normalizeContactPhone

export const sendMatchTemplate = async ({
  phoneNumber,
  recipientName,
  localTeam,
  visitorTeam,
  date,
  time,
  court,
  leagueName,
  jornada,
  templateParameters,
  templateName = getCloudConfig().templateName,
}) => {
  const config = getCloudConfig()
  const missingConfig = templateName ? getMissingWhatsAppApiConfig() : getMissingWhatsAppConfig()
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
        name: templateName,
        language: { code: config.templateLanguage },
        components: [{
          type: 'body',
          parameters: (templateParameters || [recipientName, localTeam, visitorTeam, date, time, court, leagueName, String(jornada)])
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

export const sendWhatsAppText = async ({ phoneNumber, message }) => {
  const missingConfig = getMissingWhatsAppApiConfig()
  if (missingConfig.length) throw new Error(`Falta configurar: ${missingConfig.join(', ')}`)

  const normalizedPhone = normalizeWhatsAppPhone(phoneNumber)
  if (!/^\d{8,15}$/.test(normalizedPhone)) {
    throw new Error('El teléfono debe incluir el código de país y tener entre 8 y 15 dígitos')
  }

  const response = await fetch(`https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_API_VERSION || 'v23.0'}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: normalizedPhone,
      type: 'text',
      text: { body: message },
    }),
  })

  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(result.error?.message || `WhatsApp Cloud API respondió HTTP ${response.status}`)
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
  const missingConfig = getMissingWhatsAppApiConfig()
  if (missingConfig.length) throw new Error(`Falta configurar: ${missingConfig.join(', ')}`)
  
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
  const adminPhone = options.adminPhone || process.env.ADMIN_WHATSAPP_NUMBER || process.env.WHATSAPP_SCHEDULED_TEST_PHONE
  const normalizedAdminPhone = normalizeWhatsAppPhone(adminPhone)
  const shouldSend = options.sendWhatsApp ?? (process.env.TEST_MODE !== 'true')
  if (!/^\d{8,15}$/.test(normalizedAdminPhone)) {
    throw new Error('El teléfono de WhatsApp del administrador no está configurado correctamente.')
  }
  if (shouldSend && (!process.env.WHATSAPP_ACCESS_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID)) {
    throw new Error('Falta configurar la API de WhatsApp para enviar la alerta al administrador.')
  }

  const idPartido = match.idPartido || '-'
  const equipoLocal = match.equipoLocal_id?.nombre || 'Equipo Local'
  const equipoVisitante = match.equipoVisitante_id?.nombre || 'Equipo Visitante'
  const fecha = match.fecha ? dayjs(match.fecha).locale('es').format('DD [de] MMMM') : 'Fecha por confirmar'
  const hora = match.hora || 'Hora por confirmar'
  const cancha = match.cancha_id?.nombre || 'Cancha por confirmar'
  const nombreArbitro = match.arbitro_id?.nombre || 'Árbitro'
  const telArbitro = match.arbitro_id?.telefono || 'Sin teléfono'
  const motivo = options.motivo || match.arbitro_motivo_respuesta || match.arbitro_motivo_rechazo || 'No puedo asistir'
  const adminName = options.adminName || 'Admin'
  const message = `ATENCIÓN ADMIN - ARBITRAJE REQUIERE ACCIÓN\n\nHola ${adminName}, el partido ${idPartido} necesita reasignación de árbitro:\n\n${equipoLocal} vs ${equipoVisitante}\nFecha: ${fecha} ${hora}\nCancha: ${cancha}\n\nÁrbitro asignado: ${nombreArbitro}\nTelefono: ${telArbitro}\nMotivo: ${motivo}\n\nFavor de solucionar y confirmar en barrio leagues.`

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

  let log = null
  if (options.recordLog !== false && mongoose.connection.readyState === 1) {
    log = await NotificationLog.create({
      match_id: match._id,
      to: normalizedAdminPhone,
      recipient_name: adminName,
      role: 'admin',
      type: 'admin_alert',
      message,
      status: shouldSend ? 'pending' : 'simulated',
      sent_at: shouldSend ? undefined : new Date(),
      test_mode: !shouldSend,
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
  }

  let messageId = null
  if (shouldSend) {
    try {
      const response = await fetch(`https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_API_VERSION || 'v23.0'}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: normalizedAdminPhone,
          type: 'template',
          template: {
            name: 'alerta_arbitro',
            language: { code: process.env.WHATSAPP_MATCH_TEMPLATE_LANGUAGE || 'es_MX' },
            components: [{
              type: 'body',
              parameters: variables.map((text) => ({ type: 'text', text })),
            }],
          },
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(result.error?.message || `WhatsApp Cloud API respondió HTTP ${response.status}`)
      }
      messageId = result.messages?.[0]?.id || null
      if (log) {
        log.status = 'sent'
        log.sent_at = new Date()
        log.metadata = { ...log.metadata, messageId }
        await log.save()
      }
    } catch (error) {
      if (log) {
        log.status = 'failed'
        log.error_message = error.message
        await log.save()
      }
      throw error
    }
  }

  return {
    success: true,
    status: shouldSend ? 'sent' : 'simulated',
    adminPhone: normalizedAdminPhone,
    variables,
    logId: log?._id || null,
    messageId,
  }
}
