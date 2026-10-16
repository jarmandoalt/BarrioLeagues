import express from 'express'
import mongoose from 'mongoose'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import 'dayjs/locale/es.js'
import { Match } from '../models/Match.js'
import { NotificationLog } from '../models/NotificationLog.js'
import {
  isTestMode,
  getTimeFactor,
  getRefereeConfirmationTimeoutMs,
  OFFICIAL_SCHEDULE_TABLE,
  calculateScheduleNoticeTimes,
  notifyReferee,
  notifyCaptains,
  checkRefereeConfirmations,
  confirmRefereeAssignment,
} from '../services/scheduleNotificationService.js'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.locale('es')

const router = express.Router()

/**
 * Requisito 4:
 * POST /api/test/simular-jornada
 * Simula la entrega de horarios según la tabla oficial para probar rápido.
 * Body (todo opcional):
 * {
 *   matchDate: "YYYY-MM-DD", // o fecha
 *   matchTime: "HH:mm",
 *   jornada: 1,
 *   leagueId: "barrio_test",
 *   matchId: "6acf1a44...", // o idPartido "100001"
 *   simulateTimeout: true,  // opcional: ajusta referee_notified_at a hace 9 mins para probar timeout de 8 mins inmediatamente
 *   minutesAgo: 9           // opcional: minutos atrás para simular tiempo transcurrido
 * }
 */
router.post('/test/simular-jornada', async (req, res) => {
  try {
    const {
      matchDate,
      fecha,
      matchTime,
      hora,
      leagueId,
      liga_id,
      jornada,
      matchId,
      idPartido,
      simulateTimeout,
      minutesAgo,
    } = req.body

    const query = { estado: 'programado' }
    const dateInput = matchDate || fecha

    if (dateInput) {
      const parsedDate = dayjs(dateInput)
      if (!parsedDate.isValid()) {
        return res.status(400).json({ error: 'Fecha inválida. Usa formato YYYY-MM-DD' })
      }
      query.fecha = {
        $gte: parsedDate.startOf('day').toDate(),
        $lt: parsedDate.add(1, 'day').startOf('day').toDate(),
      }
    }

    const leagueSlug = leagueId || liga_id
    if (leagueSlug) {
      query.liga_id = leagueSlug
    }

    if (jornada) {
      query.jornada = Number(jornada)
    }

    const specificId = matchId || idPartido
    if (specificId) {
      if (mongoose.isValidObjectId(specificId)) {
        query._id = specificId
      } else {
        query.idPartido = specificId
      }
    }

    let matches = await Match.find(query)
      .populate('arbitro_id')
      .populate('equipoLocal_id')
      .populate('equipoVisitante_id')

    // Si no encontró con el filtro estricto pero no se pasó ID, intentar buscar cualquier partido programado
    if (matches.length === 0 && !specificId && !dateInput) {
      matches = await Match.find({ estado: 'programado' })
        .populate('arbitro_id')
        .populate('equipoLocal_id')
        .populate('equipoVisitante_id')
        .limit(7)
    }

    if (matches.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se encontraron partidos programados para simular',
        filtersApplied: { matchDate: dateInput, leagueId: leagueSlug, jornada, specificId },
      })
    }

    console.log(`\n======================================================`)
    console.log(`[TEST_MODE] INICIANDO SIMULACIÓN DE JORNADA (${matches.length} partidos)`)
    console.log(`======================================================`)

    const processed = []
    const allNotifications = []

    // Si se solicitó simular timeout (para probar que en 8 minutos se alerta al admin)
    const simulatedNoticeDate = simulateTimeout || minutesAgo
      ? dayjs().subtract(minutesAgo || 9, 'minute').toDate()
      : new Date()

    for (const match of matches) {
      const scheduleInfo = calculateScheduleNoticeTimes(match.fecha || new Date())
      console.log(`\n[TEST_MODE] Partido ${match.idPartido} (${match.equipoLocal_id?.nombre || 'Local'} vs ${match.equipoVisitante_id?.nombre || 'Visitante'})`)
      console.log(`  Día del partido: ${scheduleInfo.matchDayName} (${dayjs(match.fecha).format('DD/MM/YYYY')} a las ${match.hora || '15:00'})`)
      console.log(`  Regla Árbitro: ${scheduleInfo.refereeScheduleDescription} -> Fecha programada: ${dayjs(scheduleInfo.refereeNoticeDate).format('YYYY-MM-DD HH:mm')}`)
      console.log(`  Regla Capitanes: ${scheduleInfo.captainsScheduleDescription} -> Fecha programada: ${dayjs(scheduleInfo.captainsNoticeDate).format('YYYY-MM-DD HH:mm')}`)

      // Enviar aviso a árbitro
      const refLog = await notifyReferee(match, { notifiedAt: simulatedNoticeDate })
      if (refLog) allNotifications.push(refLog)

      // Enviar aviso a capitanes
      const capLogs = await notifyCaptains(match, { notifiedAt: new Date() })
      if (capLogs && capLogs.length) allNotifications.push(...capLogs)

      processed.push({
        matchId: match._id,
        idPartido: match.idPartido,
        fecha: match.fecha,
        hora: match.hora,
        dia: scheduleInfo.matchDayName,
        reglaArbitro: scheduleInfo.refereeScheduleDescription,
        reglaCapitanes: scheduleInfo.captainsScheduleDescription,
        refereeNoticeDate: scheduleInfo.refereeNoticeDate,
        captainsNoticeDate: scheduleInfo.captainsNoticeDate,
        referee_notified_at: match.referee_notified_at,
        captains_notified_at: match.captains_notified_at,
        referee_confirmed: match.referee_confirmed,
        status: 'notificaciones_enviadas',
      })
    }

    console.log(`\n[TEST_MODE] Simulación finalizada. ${allNotifications.length} notificaciones registradas en notifications_log.`)
    console.log(`======================================================\n`)

    res.json({
      success: true,
      message: `Simulación completada para ${matches.length} partido(s)`,
      testMode: isTestMode(),
      timeFactor: '1 hora = 1 minuto (en TEST_MODE)',
      timeoutReferee: `${getRefereeConfirmationTimeoutMs() / 60000} minutos`,
      matchesProcessed: processed,
      notificationsSent: allNotifications.length,
      notifications: allNotifications,
    })
  } catch (error) {
    console.error('[Test] Error en simular-jornada:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * Requisito 3:
 * GET /api/test/logs
 * Retorna todos los mensajes guardados en notifications_log
 * Query params: ?role=arbitro&status=simulated&limit=50&skip=0
 */
router.get('/test/logs', async (req, res) => {
  try {
    const { role, status, limit = 100, skip = 0, matchId, idPartido, type } = req.query

    const query = {}
    if (role) query.role = role
    if (status) query.status = status
    if (type) query.type = type

    if (matchId && mongoose.isValidObjectId(matchId)) {
      query.match_id = matchId
    }

    if (idPartido) {
      query['metadata.idPartido'] = idPartido
    }

    if (req.query.test_mode !== undefined) {
      query.test_mode = req.query.test_mode === 'true'
    }

    const logs = await NotificationLog.find(query)
      .sort({ created_at: -1, createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip))
      .populate('match_id')

    const total = await NotificationLog.countDocuments(query)

    res.json({
      success: true,
      total,
      count: logs.length,
      page: {
        current: Math.floor(Number(skip) / Number(limit)) + 1,
        size: Number(limit),
        hasMore: Number(skip) + logs.length < total,
      },
      logs: logs.map((log) => ({
        id: log._id,
        to: log.to,
        recipient_name: log.recipient_name,
        role: log.role,
        type: log.type,
        message: log.message,
        status: log.status,
        sent_at: log.sent_at,
        created_at: log.created_at || log.createdAt,
        test_mode: log.test_mode,
        error_message: log.error_message,
        metadata: log.metadata,
      })),
    })
  } catch (error) {
    console.error('[Test] Error en GET /api/test/logs:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * Requisito 4:
 * POST /api/test/confirmar-arbitro/:id
 * Confirma rápidamente que el árbitro asistirá al partido
 * :id puede ser el ObjectId del partido, el idPartido de 6 dígitos o el ObjectId del árbitro
 */
const handleConfirmarArbitro = async (req, res) => {
  try {
    const targetId = req.params.id || req.params.matchId
    if (!targetId) {
      return res.status(400).json({ success: false, error: 'Identificador de partido o árbitro requerido' })
    }

    const result = await confirmRefereeAssignment(targetId)

    res.json({
      success: true,
      message: `Confirmación registrada para árbitro ${result.match.arbitro_id?.nombre || ''}`,
      match: {
        id: result.match._id,
        idPartido: result.match.idPartido,
        referee_name: result.match.arbitro_id?.nombre,
        referee_confirmed: result.match.referee_confirmed,
        confirmado_arbitro: result.match.confirmado_arbitro,
        referee_confirmed_at: result.match.referee_confirmed_at,
      },
      confirmationLog: result.confirmationLog,
    })
  } catch (error) {
    console.error('[Test] Error en confirmar-arbitro:', error.message)
    res.status(error.message.includes('No se encontró') ? 404 : 500).json({
      success: false,
      error: error.message,
    })
  }
}

router.post('/test/confirmar-arbitro/:id', handleConfirmarArbitro)
router.post('/test/confirmar-arbitro/match/:matchId', handleConfirmarArbitro)

/**
 * POST /api/test/chequear-confirmaciones
 * Ejecuta manualmente el chequeo de confirmaciones (8 horas / 8 minutos en test mode)
 */
router.post('/test/chequear-confirmaciones', async (req, res) => {
  try {
    console.log('[TEST_MODE] Chequeando confirmaciones de árbitros...')
    const alerts = await checkRefereeConfirmations()

    res.json({
      success: true,
      message: `Chequeo completado. ${alerts.length} alerta(s) generada(s) para el admin.`,
      alertsGenerated: alerts.length,
      alerts,
    })
  } catch (error) {
    console.error('[Test] Error en chequear-confirmaciones:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/test/limpiar-logs
 * Borra todos los logs de notifications_log
 */
router.post('/test/limpiar-logs', async (req, res) => {
  try {
    const result = await NotificationLog.deleteMany({})

    res.json({
      success: true,
      message: `${result.deletedCount} logs eliminados de notifications_log`,
      deletedCount: result.deletedCount,
    })
  } catch (error) {
    console.error('[Test] Error en limpiar-logs:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/test/info
 * Información del sistema de entrega de horarios y estado de TEST_MODE
 */
router.get('/test/info', (req, res) => {
  const testModeActive = isTestMode()
  const timeoutMs = getRefereeConfirmationTimeoutMs()

  res.json({
    testMode: testModeActive,
    timeFactor: testModeActive ? '1 hora = 1 minuto' : '1 hora = 1 hora (producción)',
    refereeConfirmationTimeout: `${timeoutMs / 60000} minutos (${testModeActive ? 'en TEST_MODE' : 'en producción: 8 horas'})`,
    cronSchedule: testModeActive ? 'cada 1 minuto (* * * * *)' : 'diario a las 8:00 AM (0 8 * * *)',
    officialScheduleTable: OFFICIAL_SCHEDULE_TABLE,
    endpoints: {
      'POST /api/test/simular-jornada': 'Simula avisos de horario según tabla oficial (soporta matchDate, jornada, simulateTimeout)',
      'GET /api/test/logs': 'Lista todos los logs guardados en notifications_log',
      'POST /api/test/confirmar-arbitro/:id': 'Confirma asistencia de árbitro por ID de partido o árbitro',
      'POST /api/test/chequear-confirmaciones': 'Verifica timeout de árbitros y genera alerta admin si > 8h (8min en test)',
      'POST /api/test/limpiar-logs': 'Limpia la tabla notifications_log',
    },
  })
})

/**
 * POST /api/test/enviar-plantilla-arbitro (compatibilidad de pruebas)
 */
router.post('/test/enviar-plantilla-arbitro', async (req, res) => {
  try {
    let match = null
    if (req.body.matchId) {
      match = await Match.findById(req.body.matchId).populate('arbitro_id liga_id equipoLocal_id equipoVisitante_id')
    } else {
      match = await Match.findOne({ estado: 'programado' }).populate('arbitro_id liga_id equipoLocal_id equipoVisitante_id')
    }

    if (!match) {
      return res.status(404).json({ error: 'No hay partidos para probar' })
    }

    const refLog = await notifyReferee(match)

    res.json({
      success: true,
      message: 'Plantilla de prueba procesada',
      match: {
        id: match._id,
        idPartido: match.idPartido,
        referee: match.arbitro_id?.nombre,
        phone: match.arbitro_id?.telefono,
        date: match.fecha,
        time: match.hora,
      },
      log: refLog,
    })
  } catch (error) {
    console.error('[Test] Error en enviar-plantilla-arbitro:', error)
    res.status(500).json({ error: error.message })
  }
})

export { router as testRoutes }
