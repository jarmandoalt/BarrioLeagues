import mongoose from 'mongoose'
import { Router } from 'express'
import { League } from '../models/League.js'
import { Match } from '../models/Match.js'
import { getMissingWhatsAppConfig, normalizeWhatsAppPhone, sendMatchTemplate, sendAlertaArbitro } from '../services/whatsappCloudService.js'
import { NotificationLog } from '../models/NotificationLog.js'

export const whatsappRoutes = Router()

whatsappRoutes.post('/ligas/:slug/avanzar-jornada-whatsapp', async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ message: 'MongoDB no está conectado' })
  }

  const missingConfig = getMissingWhatsAppConfig()
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
      const recipients = [
        { role: 'Árbitro', name: match.arbitro_id?.nombre || 'Árbitro', phone: match.arbitro_id?.telefono || '' },
        { role: 'Contacto del equipo (DT)', name: match.equipoLocal_id?.dt?.nombre || 'Contacto equipo local', phone: match.equipoLocal_id?.dt?.whatsapp || '' },
        { role: 'Contacto del equipo (DT)', name: match.equipoVisitante_id?.dt?.nombre || 'Contacto equipo visitante', phone: match.equipoVisitante_id?.dt?.whatsapp || '' },
      ]

      for (const recipient of recipients) {
        const result = {
          id: `${match._id}-${recipient.role}-${normalizeWhatsAppPhone(recipient.phone)}`,
          fixture,
          role: recipient.role,
          name: recipient.name,
          phone: recipient.phone,
          message: `Hola ${recipient.name}, te compartimos los detalles del partido de la jornada ${nextJornada}: ${fixture}, ${matchDate} a las ${time}, ${court}.`,
        }
        try {
          const sent = await sendMatchTemplate({
            phoneNumber: recipient.phone,
            recipientName: recipient.name,
            localTeam: localName,
            visitorTeam: visitorName,
            date: matchDate,
            time,
            court,
            leagueName: currentLeague.nombre,
            jornada: nextJornada,
          })
          notifications.push({ ...result, status: sent.status, messageId: sent.messageId })
        } catch (error) {
          notifications.push({ ...result, status: 'failed', error: error.message })
        }
      }
    }

    return res.json({ league: updatedLeague, jornada: nextJornada, notifications })
  } catch (error) {
    return res.status(500).json({ message: 'No se pudo avanzar la jornada y procesar los avisos', error: error.message })
  }
})

/**
 * Webhook para recibir respuestas de botones interactivos de WhatsApp
 */
whatsappRoutes.post('/webhook/button-response', async (req, res) => {
  try {
    const { entry } = req.body
    
    if (!entry || !entry[0] || !entry[0].changes) {
      return res.json({ status: 'ok' }) // Responder OK al webhook verificador
    }

    const changes = entry[0].changes[0]
    const messageData = changes.value.messages?.[0]

    if (!messageData || !messageData.interactive) {
      return res.json({ status: 'ok' })
    }

    const payload = messageData.interactive.button_reply?.payload
    const senderPhone = messageData.from
    const messageId = messageData.id

    if (!payload || !payload.startsWith('confirm_')) {
      return res.json({ status: 'ok' })
    }

    // Parsear payload: "confirm_yes_${matchId}" o "confirm_no_${matchId}"
    const [, response, matchIdStr] = payload.split('_')
    const confirmado = response === 'yes' ? 'confirmado' : 'rechazado'

    // Buscar el partido
    const match = await Match.findById(matchIdStr).populate('arbitro_id liga_id')
    if (!match) {
      console.error(`[WhatsApp] Partido no encontrado: ${matchIdStr}`)
      return res.json({ status: 'ok' })
    }

    // Actualizar estado del partido
    match.confirmado_arbitro = confirmado
    match.arbitro_estado_confirmacion = confirmado
    match.referee_confirmed = confirmado === 'confirmado'
    match.referee_confirmed_at = new Date()
    match.arbitro_fecha_respuesta = new Date()
    if (confirmado === 'rechazado') {
      match.requiere_reasignacion = true
      match.arbitro_motivo_rechazo = req.body.motivo || messageData.interactive?.button_reply?.title || 'No puedo asistir'
    } else {
      match.requiere_reasignacion = false
    }
    await match.save()

    // Registrar la respuesta
    await NotificationLog.create({
      match_id: match._id,
      to: senderPhone,
      role: 'arbitro',
      type: 'referee_confirmation',
      message: `Árbitro respondió: ${confirmado}`,
      status: 'delivered',
      metadata: {
        payload,
        button_response: confirmado,
        messageId,
        match_date: match.fecha,
        match_time: match.hora,
        motivo: match.arbitro_motivo_rechazo,
      },
    })

    console.log(`[WhatsApp] Respuesta recibida: ${confirmado} para partido ${match.idPartido}`)

    if (confirmado === 'rechazado') {
      await sendAlertaArbitro(match, { motivo: match.arbitro_motivo_rechazo })
    }

    return res.json({ status: 'ok' })
  } catch (error) {
    console.error('[WhatsApp] Error procesando respuesta:', error)
    return res.json({ status: 'ok' }) // Siempre responder OK para no reintentar
  }
})