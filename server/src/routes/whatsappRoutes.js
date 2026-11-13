import mongoose from 'mongoose'
import { Router } from 'express'
import { verifyWhatsAppWebhookSignature } from '../services/whatsappWebhookSecurity.js'
import { League } from '../models/League.js'
import { Match } from '../models/Match.js'
import { getMissingWhatsAppApiConfig, normalizeWhatsAppPhone, sendAlertaArbitro, sendWhatsAppText } from '../services/whatsappCloudService.js'
import { getWhatsAppButtonReply, getWhatsAppTextReply } from '../services/whatsappWebhookPayload.js'
import { NotificationLog } from '../models/NotificationLog.js'
import { getRefereeConfirmationTimeoutMs, notifyReferee } from '../services/scheduleNotificationService.js'

export const whatsappRoutes = Router()

const findPendingTextReplyCandidates = async (senderPhone, reply) => {
  const candidates = []
  const normalizedPhone = normalizeWhatsAppPhone(senderPhone)
  const matchFilter = reply.matchId ? { idPartido: reply.matchId } : {}

  if (!reply.role || reply.role === 'arbitro') {
    const cutoff = new Date(Date.now() - getRefereeConfirmationTimeoutMs())
    const matches = await Match.find({
      ...matchFilter,
      estado: 'programado',
      arbitro_estado_confirmacion: 'pendiente',
      referee_confirmed: { $ne: true },
      referee_notified_at: { $gte: cutoff, $lte: new Date() },
    })
      .select('_id idPartido arbitro_id')
      .populate('arbitro_id', 'telefono')
      .sort({ referee_notified_at: -1 })
      .limit(30)

    for (const match of matches) {
      if (normalizeWhatsAppPhone(match.arbitro_id?.telefono) !== normalizedPhone) continue
      candidates.push({ role: 'arbitro', match })
    }
  }

  if (!reply.role || reply.role === 'capitan') {
    const recentCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    const notifications = await NotificationLog.find({
      ...(reply.matchId ? { 'metadata.idPartido': reply.matchId } : {}),
      role: 'capitan',
      type: 'schedule_notification',
      status: { $in: ['sent', 'delivered'] },
      created_at: { $gte: recentCutoff },
      'metadata.response': { $exists: false },
    })
      .sort({ created_at: -1 })
      .limit(100)
      .populate('match_id', 'idPartido estado')

    const seenCaptainFixtures = new Set()
    for (const notification of notifications) {
      const fixture = notification.match_id
      if (
        normalizeWhatsAppPhone(notification.to) !== normalizedPhone
        || !fixture
        || fixture.estado !== 'programado'
      ) continue

      const teamRole = notification.metadata?.team_role || ''
      const candidateKey = `${fixture._id}:${teamRole}`
      if (seenCaptainFixtures.has(candidateKey)) continue
      seenCaptainFixtures.add(candidateKey)
      candidates.push({ role: 'capitan', match: fixture, notification })
    }
  }

  return candidates
}

const recordCaptainReply = async ({ candidate, senderPhone, messageData, reply }) => {
  const update = await NotificationLog.updateOne(
    { _id: candidate.notification._id, 'metadata.response': { $exists: false } },
    {
      $set: {
        'metadata.response': reply.response,
        'metadata.responseReceivedAt': new Date(),
        'metadata.responseMessageId': messageData.id,
        'metadata.responseText': messageData.text.body,
      },
    },
  )

  if (update.modifiedCount !== 1) return false

  console.log(`[WhatsApp] Respuesta recibida: ${reply.response} del capitán para partido ${candidate.match.idPartido}.`)
  return true
}

const updateWhatsAppDeliveryStatus = async (statusUpdate) => {
  if (!statusUpdate.id || !['sent', 'delivered', 'read', 'failed'].includes(statusUpdate.status)) return

  const fields = {
    'metadata.deliveryStatus': statusUpdate.status,
    'metadata.deliveryUpdatedAt': new Date(),
  }
  if (statusUpdate.status === 'failed') {
    fields.status = 'failed'
    fields.error_message = statusUpdate.errors?.[0]?.message
      || statusUpdate.errors?.[0]?.title
      || 'WhatsApp no pudo entregar el mensaje'
  } else {
    fields.status = statusUpdate.status === 'read' ? 'delivered' : statusUpdate.status
  }

  const result = await NotificationLog.updateOne(
    { 'metadata.messageId': statusUpdate.id },
    { $set: fields },
  )
  if (result.matchedCount) {
    console.log(`[WhatsApp] Estado ${statusUpdate.status} recibido para mensaje ${statusUpdate.id}.`)
  }
}

whatsappRoutes.post('/ligas/:slug/avanzar-jornada-whatsapp', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ message: 'MongoDB no está conectado' })
  }

  const missingConfig = getMissingWhatsAppApiConfig()
  if (missingConfig.length) {
    return res.status(503).json({ message: `Falta configurar la API de WhatsApp: ${missingConfig.join(', ')}` })
  }

  const nextJornada = Number(req.body.jornada)
  if (!Number.isInteger(nextJornada) || nextJornada < 1) {
    return res.status(400).json({ message: 'La jornada debe ser un número entero mayor a cero' })
  }
  const actualizacionJornada = req.body.actualizacionJornada
  if (!['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'].includes(actualizacionJornada)) {
    return res.status(400).json({ message: 'El día de actualización de jornada no es válido' })
  }

  try {
    const slug = req.params.slug.toLowerCase()
    const currentLeague = await League.findOne({ slug })
    if (!currentLeague) return res.status(404).json({ message: 'Liga no encontrada' })
    if (nextJornada !== currentLeague.jornada + 1) {
      return res.status(409).json({ message: `La jornada actual es ${currentLeague.jornada}; guarda los cambios y vuelve a intentar el avance` })
    }

    const updatedLeague = await League.findOneAndUpdate(
      { _id: currentLeague._id, jornada: currentLeague.jornada },
      { $set: { jornada: nextJornada, actualizacionJornada } },
      { new: true, runValidators: true },
    )
    if (!updatedLeague) return res.status(409).json({ message: 'La jornada cambió mientras se procesaba la solicitud' })

    const matches = await Match.find({ liga_id: slug, jornada: nextJornada, estado: 'programado' })
      .populate('equipoLocal_id', 'nombre dt')
      .populate('equipoVisitante_id', 'nombre dt')
      .populate('arbitro_id', 'nombre telefono')
      .populate('cancha_id', 'nombre')
      .sort({ fecha: 1, hora: 1 })

    const notifications = []
    for (const match of matches) {
      const matchDate = match.fecha
        ? new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(match.fecha)
        : 'fecha por confirmar'
      const time = match.hora || 'hora por confirmar'
      const localName = match.equipoLocal_id?.nombre || 'Equipo local'
      const visitorName = match.equipoVisitante_id?.nombre || 'Equipo visitante'
      const fixture = `${localName} vs ${visitorName}`
      const court = match.cancha_id?.nombre || 'cancha por confirmar'
      const recipient = {
        role: 'Árbitro',
        name: match.arbitro_id?.nombre || 'Árbitro',
        phone: match.arbitro_id?.telefono || '',
      }
      const notification = {
        id: `${match._id}-${recipient.role}-${normalizeWhatsAppPhone(recipient.phone)}`,
        fixture,
        role: recipient.role,
        name: recipient.name,
        phone: recipient.phone,
        message: `Hola ${recipient.name}, te compartimos los detalles del partido de la jornada ${nextJornada}: ${fixture}, ${matchDate} a las ${time}, ${court}. Confirma si puedes asistir.`,
      }
      const log = await notifyReferee(match)
      notifications.push({
        ...notification,
        status: log?.status || 'failed',
        error: log?.error_message,
        messageId: log?.metadata?.messageId,
      })
    }

    return res.json({ league: updatedLeague, jornada: nextJornada, notifications })
  } catch (error) {
    return res.status(500).json({ message: 'No se pudo avanzar la jornada y procesar los avisos', error: error.message })
  }
})

/**
 * Webhook para recibir respuestas de botones interactivos de WhatsApp
 */
whatsappRoutes.get('/webhook/button-response', (req, res) => {
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']
  if (!verifyToken || token !== verifyToken || typeof challenge !== 'string') {
    return res.sendStatus(403)
  }

  return res.type('text/plain').status(200).send(challenge)
})

export const handleWhatsAppWebhookPost = async (req, res) => {
  try {
    const signature = req.get('x-hub-signature-256')
    if (!signature) {
      console.warn('[WhatsApp Webhook] POST sin firma recibido; se ignora.')
      return
    }

    const appSecret = process.env.WHATSAPP_APP_SECRET
    if (!appSecret) {
      console.error('[WhatsApp Webhook] No está configurada la validación de firma.')
      return
    }
    if (!verifyWhatsAppWebhookSignature(req.rawBody, signature, appSecret)) {
      console.warn('[WhatsApp Webhook] Firma inválida; se ignora el payload.')
      return
    }

    const entries = Array.isArray(req.body.entry) ? req.body.entry : []
    if (!entries.length) {
      return
    }

    for (const entry of entries) {
      for (const change of entry.changes || []) {
        for (const statusUpdate of change.value?.statuses || []) {
          await updateWhatsAppDeliveryStatus(statusUpdate)
        }
      }
    }

    const messageData = entries
      .flatMap((entry) => entry.changes || [])
      .flatMap((change) => change.value?.messages || [])
      .find((message) => !req.whatsappFlowTestMessageIds?.has(message.id))

    if (!messageData) {
      return
    }
    if (req.whatsappFlowTestMessageIds?.has(messageData.id)) {
      return
    }

    const senderPhone = messageData.from
    const messageId = messageData.id
    const buttonReply = getWhatsAppButtonReply(messageData)
    const textReply = getWhatsAppTextReply(messageData)
    const payload = messageData.type === 'button' ? messageData.button?.payload : buttonReply?.payload
    const buttonText = messageData.type === 'button' ? messageData.button?.text : null
    let responsePayload = payload

    if (!responsePayload && textReply) {
      if (messageId && await NotificationLog.exists({ 'metadata.responseMessageId': messageId })) {
        return
      }

      const candidates = await findPendingTextReplyCandidates(senderPhone, textReply)
      if (candidates.length > 1) {
        const options = candidates
          .slice(0, 5)
          .map(({ role, match }) => `${role === 'arbitro' ? 'ARBITRO' : 'CAPITAN'} ${textReply.response.toUpperCase()} ${match.idPartido}`)
          .join(' o ')
        try {
          await sendWhatsAppText({
            phoneNumber: senderPhone,
            message: `Recibimos tu respuesta, pero hay varios partidos pendientes. Indica a cuál corresponde: ${options}.`,
          })
        } catch (error) {
          console.error('[WhatsApp] No se pudo solicitar la aclaración de una respuesta:', error.message)
        }
        return
      }

      if (candidates.length === 1 && candidates[0].role === 'capitan') {
        await recordCaptainReply({ candidate: candidates[0], senderPhone, messageData, reply: textReply })
        return
      }
      if (candidates.length === 1 && candidates[0].role === 'arbitro') {
        responsePayload = `confirm_${textReply.response}_${candidates[0].match._id}`
      }
    }

    if (!responsePayload || !responsePayload.startsWith('confirm_')) {
      return
    }

    // Parsear payload: "confirm_yes_${matchId}" o "confirm_no_${matchId}"
    const [, response, ...matchIdParts] = responsePayload.split('_')
    const matchIdStr = matchIdParts.join('_')
    if (!['yes', 'no'].includes(response) || !mongoose.isValidObjectId(matchIdStr)) {
      return
    }
    const confirmado = response === 'yes' ? 'confirmado' : 'rechazado'

    if (messageId && await NotificationLog.exists({ 'metadata.messageId': messageId })) {
      return
    }

    const match = await Match.findById(matchIdStr)
      .populate('arbitro_id', 'nombre telefono')
      .populate('equipoLocal_id', 'nombre')
      .populate('equipoVisitante_id', 'nombre')
      .populate('cancha_id', 'nombre')
    if (!match) {
      console.error(`[WhatsApp] Partido no encontrado: ${matchIdStr}`)
      return
    }
    if (normalizeWhatsAppPhone(senderPhone) !== normalizeWhatsAppPhone(match.arbitro_id?.telefono)) {
      console.warn(`[WhatsApp] Se ignoró una respuesta de un teléfono que no corresponde al árbitro del partido ${match.idPartido}.`)
      return
    }
    if (
      match.referee_notified_at
      && Date.now() - match.referee_notified_at.getTime() >= getRefereeConfirmationTimeoutMs()
    ) {
      return
    }
    if (match.arbitro_estado_confirmacion !== 'pendiente' || match.referee_confirmed) {
      return
    }

    match.confirmado_arbitro = confirmado
    match.arbitro_estado_confirmacion = confirmado
    match.referee_confirmed = confirmado === 'confirmado'
    match.referee_confirmed_at = confirmado === 'confirmado' ? new Date() : null
    match.arbitro_fecha_respuesta = new Date()
    const motivo = buttonReply?.title || buttonText || (textReply ? messageData.text.body : null)
      || (confirmado === 'confirmado' ? 'Sí puedo asistir' : 'No puedo asistir')
    if (confirmado === 'rechazado') {
      match.requiere_reasignacion = true
      match.arbitro_motivo_respuesta = motivo
      match.arbitro_motivo_rechazo = motivo
    } else {
      match.requiere_reasignacion = false
      match.arbitro_motivo_respuesta = motivo
      match.arbitro_motivo_rechazo = undefined
    }
    const updateResult = await Match.updateOne(
      {
        _id: match._id,
        arbitro_estado_confirmacion: 'pendiente',
        referee_confirmed: { $ne: true },
      },
      {
        $set: {
          confirmado_arbitro: confirmado,
          arbitro_estado_confirmacion: confirmado,
          referee_confirmed: confirmado === 'confirmado',
          referee_confirmed_at: confirmado === 'confirmado' ? match.referee_confirmed_at : null,
          arbitro_fecha_respuesta: match.arbitro_fecha_respuesta,
          arbitro_motivo_respuesta: motivo,
          requiere_reasignacion: confirmado === 'rechazado',
          ...(confirmado === 'rechazado' ? { arbitro_motivo_rechazo: motivo } : {}),
        },
        ...(confirmado === 'confirmado' ? { $unset: { arbitro_motivo_rechazo: 1 } } : {}),
      },
    )
    if (updateResult.modifiedCount !== 1) {
      return
    }
    match.confirmado_arbitro = confirmado
    match.arbitro_estado_confirmacion = confirmado
    match.referee_confirmed = confirmado === 'confirmado'
    match.referee_confirmed_at = confirmado === 'confirmado' ? match.referee_confirmed_at : null
    match.arbitro_motivo_respuesta = motivo
    match.requiere_reasignacion = confirmado === 'rechazado'
    if (confirmado === 'rechazado') match.arbitro_motivo_rechazo = motivo
    else match.arbitro_motivo_rechazo = undefined

    await NotificationLog.create({
      match_id: match._id,
      to: senderPhone,
      role: 'arbitro',
      type: 'referee_confirmation',
      message: `Árbitro respondió: ${confirmado}`,
      status: 'delivered',
      metadata: {
        payload: responsePayload,
        button_response: confirmado,
        messageId,
        match_date: match.fecha,
        match_time: match.hora,
        motivo,
      },
    })

    console.log(`[WhatsApp] Respuesta recibida: ${confirmado} para partido ${match.idPartido}`)

    if (confirmado === 'rechazado') {
      try {
        const league = await League.findOne({ slug: match.liga_id }).select('dueno')
        const existingAlert = await NotificationLog.findOne({
          match_id: match._id,
          role: 'admin',
          type: { $in: ['admin_alert', 'referee_rejection'] },
          status: 'sent',
        }).sort({ sent_at: -1, created_at: -1 })
        if (existingAlert) {
          await Match.updateOne(
            { _id: match._id, arbitro_estado_confirmacion: 'rechazado' },
            { $set: { admin_notified_at: existingAlert.sent_at || existingAlert.created_at || new Date() } },
          )
          return
        }
        await sendAlertaArbitro(match, {
          motivo,
          adminPhone: league?.dueno?.contacto,
          adminName: league?.dueno?.nombre,
        })
        await Match.updateOne(
          { _id: match._id, arbitro_estado_confirmacion: 'rechazado' },
          { $set: { admin_notified_at: new Date() } },
        )
      } catch (error) {
        console.error(`[WhatsApp] No se pudo enviar la alerta al administrador para el partido ${match.idPartido}:`, error.message)
      }
    }

  } catch (error) {
    console.error('[WhatsApp] Error procesando respuesta:', error)
  } finally {
    res.sendStatus(200)
  }
}

whatsappRoutes.post('/webhook/button-response', handleWhatsAppWebhookPost)