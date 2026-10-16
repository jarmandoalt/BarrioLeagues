import express from 'express'
import { Match } from '../models/Match.js'
import { Referee } from '../models/Referee.js'
import { League } from '../models/League.js'
import { NotificationLog } from '../models/NotificationLog.js'
import { sendRefereeTemplateWithButtons } from '../services/whatsappCloudService.js'
import { normalizeContactPhone } from '../utils/normalizeContactPhone.js'

const router = express.Router()

/**
 * POST /api/notifications/enviar-plantilla-arbitro
 * Envía la plantilla de WhatsApp a un árbitro específico
 * Funciona tanto en TEST_MODE como en producción
 * 
 * Body:
 * {
 *   matchId: string (ObjectId del partido)
 *   o
 *   phoneNumber: string (número del árbitro sin +),
 *   refereeName: string,
 *   leagueName: string,
 *   fecha: string (DD/MM/YYYY),
 *   hora: string (HH:mm),
 *   equipoLocal: string,
 *   equipoVisitante: string,
 *   cancha: string,
 *   jornada: number,
 *   idPartido: string,
 *   adminName: string
 * }
 */
router.post('/notifications/enviar-plantilla-arbitro', async (req, res) => {
  try {
    let matchData = {}
    
    // Opción 1: Si se proporciona matchId, obtener datos de la BD
    if (req.body.matchId) {
      const match = await Match.findById(req.body.matchId)
        .populate('arbitro_id')
        .populate('liga_id')
        .populate('cancha_id')
        .populate('equipoLocal_id')
        .populate('equipoVisitante_id')
      
      if (!match) {
        return res.status(404).json({ error: 'Partido no encontrado' })
      }
      
      if (!match.arbitro_id) {
        return res.status(400).json({ error: 'El partido no tiene árbitro asignado' })
      }
      
      matchData = {
        phoneNumber: match.arbitro_id.telefono,
        refereeName: match.arbitro_id.nombre,
        leagueName: match.liga_id?.nombre || 'Liga',
        fecha: match.fecha,
        hora: match.hora,
        equipoLocal: match.equipoLocal_id?.nombre || 'Equipo Local',
        equipoVisitante: match.equipoVisitante_id?.nombre || 'Equipo Visitante',
        cancha: match.cancha_id?.nombre || 'Cancha',
        jornada: match.jornada || 1,
        idPartido: match.idPartido,
        adminName: match.liga_id?.admin?.nombre || 'Admin',
        matchId: match._id,
      }
    } 
    // Opción 2: Si se proporciona phoneNumber, usar datos manuales
    else if (req.body.phoneNumber) {
      matchData = {
        phoneNumber: req.body.phoneNumber,
        refereeName: req.body.refereeName || 'Árbitro',
        leagueName: req.body.leagueName || 'Liga',
        fecha: req.body.fecha || new Date().toLocaleDateString('es-MX'),
        hora: req.body.hora || '14:00',
        equipoLocal: req.body.equipoLocal || 'Equipo Local',
        equipoVisitante: req.body.equipoVisitante || 'Equipo Visitante',
        cancha: req.body.cancha || 'Cancha Principal',
        jornada: req.body.jornada || 1,
        idPartido: req.body.idPartido || 'TEST-001',
        adminName: req.body.adminName || 'Admin',
        matchId: req.body.matchId,
      }
    } else {
      return res.status(400).json({
        error: 'Se requiere matchId o phoneNumber',
        example: {
          matchId: '507f1f77bcf86cd799439011',
        },
      })
    }

    // Normalizar teléfono
    const phone = normalizeContactPhone(matchData.phoneNumber)
    
    console.log(`[WhatsApp] Enviando plantilla a árbitro: ${phone}`)
    console.log(`[WhatsApp] Árbitro: ${matchData.refereeName}`)
    console.log(`[WhatsApp] Partido: ${matchData.equipoLocal} vs ${matchData.equipoVisitante}`)
    console.log(`[WhatsApp] Cancha: ${matchData.cancha}, Hora: ${matchData.hora}`)

    // Enviar plantilla
    const result = await sendRefereeTemplateWithButtons({
      phoneNumber: phone,
      refereeName: matchData.refereeName,
      leagueName: matchData.leagueName,
      jornada: matchData.jornada,
      fecha: matchData.fecha,
      hora: matchData.hora,
      cancha: matchData.cancha,
      equipoLocal: matchData.equipoLocal,
      equipoVisitante: matchData.equipoVisitante,
      idPartido: matchData.idPartido,
      adminName: matchData.adminName,
      matchId: matchData.matchId,
    })

    // Registrar en logs
    await NotificationLog.create({
      match_id: matchData.matchId,
      to: phone,
      role: 'arbitro',
      type: 'schedule_notification',
      message: `Plantilla enviada a ${matchData.refereeName}`,
      status: 'sent',
      test_mode: process.env.TEST_MODE === 'true',
      metadata: {
        referee_name: matchData.refereeName,
        match_date: matchData.fecha,
        match_time: matchData.hora,
        league_name: matchData.leagueName,
        messageId: result.messageId,
        whatsapp_status: result.status,
      },
    })

    console.log(`[WhatsApp] ✓ Plantilla enviada exitosamente. MessageID: ${result.messageId}`)

    res.json({
      success: true,
      message: `Plantilla enviada a ${matchData.refereeName}`,
      messageId: result.messageId,
      status: result.status,
      phone,
      referee: matchData.refereeName,
      match: `${matchData.equipoLocal} vs ${matchData.equipoVisitante}`,
      time: `${matchData.fecha} ${matchData.hora}`,
      cancha: matchData.cancha,
    })
  } catch (error) {
    console.error('[WhatsApp] Error enviando plantilla:', error.message)
    
    res.status(500).json({
      error: error.message,
      hint: 'Verifica que el token de WhatsApp sea válido y que el teléfono esté en la whitelist',
    })
  }
})

/**
 * POST /api/notifications/enviar-alerta-admin
 * Envía alerta de timeout al admin
 */
router.post('/notifications/enviar-alerta-admin', async (req, res) => {
  try {
    const { adminPhone, refereeName, matchId, leagueName } = req.body

    if (!adminPhone || !refereeName || !matchId) {
      return res.status(400).json({
        error: 'Se requieren adminPhone, refereeName, matchId y leagueName',
      })
    }

    const message = `⚠️ ALERTA: El árbitro ${refereeName} no ha confirmado el partido ${matchId} de ${leagueName}. Por favor contacta con él o reasigna el partido.`

    await NotificationLog.create({
      to: adminPhone,
      role: 'admin',
      type: 'confirmation_reminder',
      message,
      status: process.env.TEST_MODE === 'true' ? 'simulated' : 'sent',
      test_mode: process.env.TEST_MODE === 'true',
      metadata: {
        referee_name: refereeName,
        match_id: matchId,
        league_name: leagueName,
      },
    })

    console.log(`[Admin Alert] Alerta enviada a admin: ${message}`)

    res.json({
      success: true,
      message: 'Alerta enviada al admin',
      alert: message,
    })
  } catch (error) {
    console.error('[Admin Alert] Error:', error.message)
    res.status(500).json({ error: error.message })
  }
})

export default router
