import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import 'dayjs/locale/es.js'
import { Match } from '../models/Match.js'
import { Referee } from '../models/Referee.js'
import { Team } from '../models/Team.js'
import { League } from '../models/League.js'
import { NotificationLog } from '../models/NotificationLog.js'
import { sendRefereeTemplateWithButtons, sendAlertaArbitro } from './whatsappCloudService.js'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.locale('es')

/**
 * Tabla oficial de entrega de horarios:
 * LUNES, MARTES, MIERCOLES -> Aviso árbitros Viernes 8am anterior, Aviso capitanes Lunes 8am
 * JUEVES -> Aviso árbitros Lunes 8am, Aviso capitanes Martes 8am
 * VIERNES -> Aviso árbitros Martes 8am, Aviso capitanes Miercoles 8am
 * SABADO, DOMINGO -> Aviso árbitros Miercoles 8am, Aviso capitanes Jueves 8am
 */
export const OFFICIAL_SCHEDULE_TABLE = {
  LUNES: { aviso_arbitro: 'Viernes 8am anterior', aviso_capitanes: 'Lunes 8am' },
  MARTES: { aviso_arbitro: 'Viernes 8am anterior', aviso_capitanes: 'Lunes 8am anterior' },
  MIERCOLES: { aviso_arbitro: 'Viernes 8am anterior', aviso_capitanes: 'Lunes 8am anterior' },
  JUEVES: { aviso_arbitro: 'Lunes 8am', aviso_capitanes: 'Martes 8am' },
  VIERNES: { aviso_arbitro: 'Martes 8am', aviso_capitanes: 'Miércoles 8am' },
  SABADO: { aviso_arbitro: 'Miércoles 8am', aviso_capitanes: 'Jueves 8am' },
  DOMINGO: { aviso_arbitro: 'Miércoles 8am anterior', aviso_capitanes: 'Jueves 8am anterior' },
}

export const isTestMode = () => process.env.TEST_MODE === 'true'

/**
 * Factor de tiempo:
 * En TEST_MODE=true: 1 hora real = 1 minuto (factor 1/60)
 * 8 horas = 8 minutos (480,000 ms)
 */
export const getTimeFactor = () => (isTestMode() ? 1 / 60 : 1)
export const getRefereeConfirmationTimeoutMs = () => {
  return isTestMode() ? 8 * 60 * 1000 : 8 * 60 * 60 * 1000
}

/**
 * Calcula los momentos exactos de aviso a árbitros y capitanes según la tabla oficial
 * @param {Date|string|dayjs.Dayjs} matchDate
 * @returns {Object} { refereeNoticeDate, captainsNoticeDate, refereeScheduleDescription, captainsScheduleDescription, matchDayName }
 */
export const calculateScheduleNoticeTimes = (matchDate) => {
  const d = dayjs(matchDate)
  const dayOfWeek = d.day() // 0=Domingo, 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes, 6=Sábado

  let refereeNoticeDate
  let captainsNoticeDate
  let matchDayName = ''
  let refereeScheduleDescription = ''
  let captainsScheduleDescription = ''

  if (dayOfWeek === 1) {
    // LUNES -> Aviso árbitros Viernes 8am anterior, Aviso capitanes Lunes 8am
    matchDayName = 'LUNES'
    refereeScheduleDescription = 'Viernes 8am anterior'
    captainsScheduleDescription = 'Lunes 8am'
    refereeNoticeDate = d.subtract(3, 'day').hour(8).minute(0).second(0).millisecond(0)
    captainsNoticeDate = d.hour(8).minute(0).second(0).millisecond(0)
  } else if (dayOfWeek === 2) {
    // MARTES -> Aviso árbitros Viernes 8am anterior, Aviso capitanes Lunes 8am
    matchDayName = 'MARTES'
    refereeScheduleDescription = 'Viernes 8am anterior'
    captainsScheduleDescription = 'Lunes 8am anterior'
    refereeNoticeDate = d.subtract(4, 'day').hour(8).minute(0).second(0).millisecond(0)
    captainsNoticeDate = d.subtract(1, 'day').hour(8).minute(0).second(0).millisecond(0)
  } else if (dayOfWeek === 3) {
    // MIERCOLES -> Aviso árbitros Viernes 8am anterior, Aviso capitanes Lunes 8am
    matchDayName = 'MIERCOLES'
    refereeScheduleDescription = 'Viernes 8am anterior'
    captainsScheduleDescription = 'Lunes 8am anterior'
    refereeNoticeDate = d.subtract(5, 'day').hour(8).minute(0).second(0).millisecond(0)
    captainsNoticeDate = d.subtract(2, 'day').hour(8).minute(0).second(0).millisecond(0)
  } else if (dayOfWeek === 4) {
    // JUEVES -> Aviso árbitros Lunes 8am, Aviso capitanes Martes 8am
    matchDayName = 'JUEVES'
    refereeScheduleDescription = 'Lunes 8am'
    captainsScheduleDescription = 'Martes 8am'
    refereeNoticeDate = d.subtract(3, 'day').hour(8).minute(0).second(0).millisecond(0)
    captainsNoticeDate = d.subtract(2, 'day').hour(8).minute(0).second(0).millisecond(0)
  } else if (dayOfWeek === 5) {
    // VIERNES -> Aviso árbitros Martes 8am, Aviso capitanes Miercoles 8am
    matchDayName = 'VIERNES'
    refereeScheduleDescription = 'Martes 8am'
    captainsScheduleDescription = 'Miércoles 8am'
    refereeNoticeDate = d.subtract(3, 'day').hour(8).minute(0).second(0).millisecond(0)
    captainsNoticeDate = d.subtract(2, 'day').hour(8).minute(0).second(0).millisecond(0)
  } else if (dayOfWeek === 6) {
    // SABADO -> Aviso árbitros Miercoles 8am, Aviso capitanes Jueves 8am
    matchDayName = 'SABADO'
    refereeScheduleDescription = 'Miércoles 8am'
    captainsScheduleDescription = 'Jueves 8am'
    refereeNoticeDate = d.subtract(3, 'day').hour(8).minute(0).second(0).millisecond(0)
    captainsNoticeDate = d.subtract(2, 'day').hour(8).minute(0).second(0).millisecond(0)
  } else if (dayOfWeek === 0) {
    // DOMINGO -> Aviso árbitros Miercoles 8am, Aviso capitanes Jueves 8am
    matchDayName = 'DOMINGO'
    refereeScheduleDescription = 'Miércoles 8am anterior'
    captainsScheduleDescription = 'Jueves 8am anterior'
    refereeNoticeDate = d.subtract(4, 'day').hour(8).minute(0).second(0).millisecond(0)
    captainsNoticeDate = d.subtract(3, 'day').hour(8).minute(0).second(0).millisecond(0)
  }

  return {
    matchDayName,
    refereeScheduleDescription,
    captainsScheduleDescription,
    refereeNoticeDate: refereeNoticeDate.toDate(),
    captainsNoticeDate: captainsNoticeDate.toDate(),
  }
}

/**
 * Registra una notificación en la colección notifications_log
 */
export const logNotification = async (data) => {
  try {
    const notification = new NotificationLog({
      ...data,
      test_mode: isTestMode(),
      status: data.status || (isTestMode() ? 'simulated' : 'pending'),
      sent_at: data.sent_at || new Date(),
    })
    await notification.save()
    return notification
  } catch (error) {
    console.error('[NotificationLog] Error al registrar notificación:', error.message)
    return null
  }
}

/**
 * Extrae el contacto del capitán / DT de un equipo
 */
export const getTeamCaptainInfo = (team, roleLabel = 'Local') => {
  if (!team) return { name: `Capitán ${roleLabel}`, phone: '' }
  const name = team.dt?.nombre || team.capitan?.nombre || team.capitan_nombre || `Capitán ${team.nombre}`
  const phone = team.dt?.whatsapp || team.capitan?.whatsapp || team.capitan_telefono || ''
  return { name, phone }
}

/**
 * Notifica al árbitro asignado a un partido
 */
export const notifyReferee = async (match, options = {}) => {
  try {
    const referee = match.arbitro_id?._id
      ? match.arbitro_id
      : match.arbitro_id
      ? await Referee.findById(match.arbitro_id)
      : null

    if (!referee) {
      console.log(`[Schedule] Partido ${match.idPartido} no tiene árbitro asignado. Se omite aviso de árbitro.`)
      return null
    }

    const localTeam = match.equipoLocal_id?._id
      ? match.equipoLocal_id
      : await Team.findById(match.equipoLocal_id)
    const awayTeam = match.equipoVisitante_id?._id
      ? match.equipoVisitante_id
      : await Team.findById(match.equipoVisitante_id)

    const matchDateFormatted = dayjs(match.fecha).format('dddd, DD [de] MMMM')
    const matchTime = match.hora || '15:00'
    const scheduleInfo = calculateScheduleNoticeTimes(match.fecha)

    const refereeMessage = `Hola ${referee.nombre}, tienes asignado el partido de ${localTeam?.nombre || 'Equipo Local'} vs ${awayTeam?.nombre || 'Equipo Visitante'} el ${matchDateFormatted} a las ${matchTime}. Por favor confirma tu asistencia.`

    if (isTestMode()) {
      console.log(`[TEST_MODE] Aviso a Árbitro (${referee.nombre} - Tel: ${referee.telefono}): "${refereeMessage}"`)
    }

    const log = await logNotification({
      match_id: match._id,
      to: referee.telefono || 'sin_telefono',
      recipient_name: referee.nombre,
      role: 'arbitro',
      type: 'schedule_notification',
      message: refereeMessage,
      status: isTestMode() ? 'simulated' : 'pending',
      metadata: {
        match_id: match._id,
        idPartido: match.idPartido,
        match_date: match.fecha,
        match_time: matchTime,
        match_day: scheduleInfo.matchDayName,
        schedule_rule: scheduleInfo.refereeScheduleDescription,
        referee_name: referee.nombre,
        local_team: localTeam?.nombre,
        away_team: awayTeam?.nombre,
        league_id: match.liga_id,
      },
    })

    if (!isTestMode()) {
      try {
        const league = await League.findOne({ slug: match.liga_id }).catch(() => null)
        await sendRefereeTemplateWithButtons({
          phoneNumber: referee.telefono,
          refereeName: referee.nombre,
          leagueName: league?.nombre || 'Liga',
          jornada: match.jornada || 1,
          fecha: dayjs(match.fecha).format('DD/MM/YYYY'),
          hora: matchTime,
          cancha: 'Cancha',
          equipoLocal: localTeam?.nombre || 'Local',
          equipoVisitante: awayTeam?.nombre || 'Visitante',
          idPartido: match.idPartido,
          adminName: league?.dueno?.nombre || 'Admin',
          matchId: match._id.toString(),
        })
        if (log) {
          log.status = 'sent'
          await log.save()
        }
      } catch (err) {
        console.error(`[WhatsApp] Error enviando plantilla a árbitro:`, err.message)
        if (log) {
          log.status = 'failed'
          log.error_message = err.message
          await log.save()
        }
      }
    }

    // Actualizar timestamps en el partido
    match.referee_notified_at = options.notifiedAt || new Date()
    match.referee_confirmed = false
    match.confirmado_arbitro = 'pendiente'
    match.admin_notified_at = null
    await match.save()

    return log
  } catch (error) {
    console.error(`[Schedule] Error en notifyReferee para partido ${match.idPartido}:`, error)
    return null
  }
}

/**
 * Notifica a los capitanes de los equipos de un partido
 */
export const notifyCaptains = async (match, options = {}) => {
  try {
    const localTeam = match.equipoLocal_id?._id
      ? match.equipoLocal_id
      : await Team.findById(match.equipoLocal_id)
    const awayTeam = match.equipoVisitante_id?._id
      ? match.equipoVisitante_id
      : await Team.findById(match.equipoVisitante_id)

    const matchDateFormatted = dayjs(match.fecha).format('dddd, DD [de] MMMM')
    const matchTime = match.hora || '15:00'
    const scheduleInfo = calculateScheduleNoticeTimes(match.fecha)
    const logs = []

    // Notificar Capitán Local
    if (localTeam) {
      const localCap = getTeamCaptainInfo(localTeam, 'Local')
      const localMessage = `Hola ${localCap.name}, tu equipo ${localTeam.nombre} tiene partido programado contra ${awayTeam?.nombre || 'Visitante'} el ${matchDateFormatted} a las ${matchTime}. Confirma tu asistencia.`

      if (isTestMode()) {
        console.log(`[TEST_MODE] Aviso a Capitán Local (${localCap.name} - Tel: ${localCap.phone || 'N/A'}): "${localMessage}"`)
      }

      const logLocal = await logNotification({
        match_id: match._id,
        to: localCap.phone || 'sin_telefono',
        recipient_name: localCap.name,
        role: 'capitan',
        type: 'schedule_notification',
        message: localMessage,
        status: isTestMode() ? 'simulated' : 'pending',
        metadata: {
          match_id: match._id,
          idPartido: match.idPartido,
          match_date: match.fecha,
          match_time: matchTime,
          team_name: localTeam.nombre,
          team_role: 'local',
          match_day: scheduleInfo.matchDayName,
          schedule_rule: scheduleInfo.captainsScheduleDescription,
          league_id: match.liga_id,
        },
      })
      if (logLocal) logs.push(logLocal)
    }

    // Notificar Capitán Visitante
    if (awayTeam) {
      const awayCap = getTeamCaptainInfo(awayTeam, 'Visitante')
      const awayMessage = `Hola ${awayCap.name}, tu equipo ${awayTeam.nombre} tiene partido programado contra ${localTeam?.nombre || 'Local'} el ${matchDateFormatted} a las ${matchTime}. Confirma tu asistencia.`

      if (isTestMode()) {
        console.log(`[TEST_MODE] Aviso a Capitán Visitante (${awayCap.name} - Tel: ${awayCap.phone || 'N/A'}): "${awayMessage}"`)
      }

      const logAway = await logNotification({
        match_id: match._id,
        to: awayCap.phone || 'sin_telefono',
        recipient_name: awayCap.name,
        role: 'capitan',
        type: 'schedule_notification',
        message: awayMessage,
        status: isTestMode() ? 'simulated' : 'pending',
        metadata: {
          match_id: match._id,
          idPartido: match.idPartido,
          match_date: match.fecha,
          match_time: matchTime,
          team_name: awayTeam.nombre,
          team_role: 'visitante',
          match_day: scheduleInfo.matchDayName,
          schedule_rule: scheduleInfo.captainsScheduleDescription,
          league_id: match.liga_id,
        },
      })
      if (logAway) logs.push(logAway)
    }

    match.captains_notified_at = options.notifiedAt || new Date()
    await match.save()

    return logs
  } catch (error) {
    console.error(`[Schedule] Error en notifyCaptains para partido ${match.idPartido}:`, error)
    return []
  }
}

/**
 * Notifica tanto al árbitro como a los capitanes de un partido
 */
export const notifyMatchSchedule = async (match, options = {}) => {
  const refLog = await notifyReferee(match, options)
  const capLogs = await notifyCaptains(match, options)
  return [refLog, ...capLogs].filter(Boolean)
}

/**
 * Requisito 1: Si el árbitro no confirma en 8 horas (u 8 minutos en TEST_MODE), notifica al admin
 */
export const checkRefereeConfirmations = async () => {
  try {
    const timeoutMs = getRefereeConfirmationTimeoutMs()
    const cutoffTime = new Date(Date.now() - timeoutMs)

    // Buscar partidos donde se notificó al árbitro, no ha confirmado y aún no se alerta al admin
    const pendingMatches = await Match.find({
      estado: 'programado',
      referee_notified_at: { $lte: cutoffTime, $ne: null },
      referee_confirmed: { $ne: true },
      admin_notified_at: null,
    })
      .populate('arbitro_id')
      .populate('equipoLocal_id')
      .populate('equipoVisitante_id')

    const generatedAlerts = []

    for (const match of pendingMatches) {
      if (match.confirmado_arbitro === 'confirmado') {
        match.referee_confirmed = true
        await match.save()
        continue
      }

      const refereeName = match.arbitro_id?.nombre || 'No asignado'
      const localName = match.equipoLocal_id?.nombre || 'Local'
      const visitorName = match.equipoVisitante_id?.nombre || 'Visitante'
      const matchDateStr = dayjs(match.fecha).format('DD/MM/YYYY')
      const matchTime = match.hora || '15:00'
      const elapsedLabel = isTestMode() ? '8 minutos (modo prueba)' : '8 horas'

      // Obtener datos del admin / dueño de la liga
      const league = await League.findOne({
        $or: [{ slug: match.liga_id }, { _id: match.liga_id }],
      }).catch(() => null)
      const adminPhone = league?.dueno?.contacto || process.env.WHATSAPP_SCHEDULED_TEST_PHONE || 'admin'
      const adminName = league?.dueno?.nombre || 'Administrador'

      const adminAlertMessage = `[ALERTA ADMIN] El árbitro ${refereeName} no ha confirmado el partido ${match.idPartido} (${localName} vs ${visitorName}) programado para el ${matchDateStr} a las ${matchTime}. Han transcurrido ${elapsedLabel} sin confirmación. Por favor reasigna o contacta al árbitro.`

      if (isTestMode()) {
        console.log(`[TEST_MODE] ${adminAlertMessage}`)
      }

      const alertLog = await logNotification({
        match_id: match._id,
        to: adminPhone,
        recipient_name: adminName,
        role: 'admin',
        type: 'admin_alert',
        message: adminAlertMessage,
        status: isTestMode() ? 'simulated' : 'pending',
        metadata: {
          match_id: match._id,
          idPartido: match.idPartido,
          match_date: match.fecha,
          match_time: matchTime,
          referee_name: refereeName,
          referee_phone: match.arbitro_id?.telefono,
          league_id: match.liga_id,
          timeout_elapsed_ms: timeoutMs,
        },
      })

      if (!isTestMode()) {
        // En producción enviar notificación por WhatsApp o email al admin
        console.log(`[PROD ALERT] Alerta enviada a admin ${adminPhone}: ${adminAlertMessage}`)
        if (alertLog) {
          alertLog.status = 'sent'
          await alertLog.save()
        }
      }

      match.admin_notified_at = new Date()
      match.arbitro_estado_confirmacion = 'sin_respuesta'
      match.confirmado_arbitro = 'rechazado'
      match.arbitro_fecha_respuesta = new Date()
      match.requiere_reasignacion = true
      await match.save()

      await sendAlertaArbitro(match, { motivo: 'Sin respuesta del árbitro en el tiempo límite' })

      if (alertLog) generatedAlerts.push(alertLog)
    }

    return generatedAlerts
  } catch (error) {
    console.error('[Schedule] Error verificando confirmaciones de árbitros:', error)
    return []
  }
}

/**
 * Requisito 4: Confirmar árbitro rápidamente por ID (matchId, idPartido o refereeId)
 */
export const confirmRefereeAssignment = async (id) => {
  let match = null

  // Buscar por ObjectId de Match
  if (id && id.match(/^[0-9a-fA-F]{24}$/)) {
    match = await Match.findById(id).populate('arbitro_id equipoLocal_id equipoVisitante_id')
  }

  // Si no se encuentra, buscar por idPartido de 6 dígitos
  if (!match) {
    match = await Match.findOne({ idPartido: id }).populate('arbitro_id equipoLocal_id equipoVisitante_id')
  }

  // Si no se encuentra, tal vez es el id del árbitro
  if (!match && id && id.match(/^[0-9a-fA-F]{24}$/)) {
    match = await Match.findOne({
      arbitro_id: id,
      referee_confirmed: { $ne: true },
      estado: 'programado',
    }).populate('arbitro_id equipoLocal_id equipoVisitante_id')
  }

  if (!match) {
    throw new Error(`No se encontró ningún partido programado con el identificador "${id}"`)
  }

  const refereeName = match.arbitro_id?.nombre || 'Árbitro'
  const refereePhone = match.arbitro_id?.telefono || 'sin_telefono'

  match.referee_confirmed = true
  match.confirmado_arbitro = 'confirmado'
  match.referee_confirmed_at = new Date()
  await match.save()

  if (isTestMode()) {
    console.log(`[TEST_MODE] Árbitro ${refereeName} ha confirmado su asistencia para el partido ${match.idPartido}.`)
  }

  const confirmationLog = await logNotification({
    match_id: match._id,
    to: refereePhone,
    recipient_name: refereeName,
    role: 'arbitro',
    type: 'referee_confirmation',
    message: `Árbitro ${refereeName} confirmó su asistencia para el partido ${match.idPartido}.`,
    status: isTestMode() ? 'simulated' : 'delivered',
    metadata: {
      match_id: match._id,
      idPartido: match.idPartido,
      match_date: match.fecha,
      match_time: match.hora,
      referee_name: refereeName,
      action: 'confirmed',
    },
  })

  return { match, confirmationLog }
}

/**
 * Evalúa los partidos programados según la tabla oficial y la hora actual
 */
export const processScheduledNotifications = async () => {
  try {
    const now = dayjs()
    const upcomingRange = now.add(14, 'day').toDate()

    const matches = await Match.find({
      estado: 'programado',
      fecha: { $gte: now.startOf('day').subtract(1, 'day').toDate(), $lte: upcomingRange },
    })
      .populate('arbitro_id')
      .populate('equipoLocal_id')
      .populate('equipoVisitante_id')

    let notifiedReferees = 0
    let notifiedCaptains = 0

    for (const match of matches) {
      if (!match.fecha) continue
      const { refereeNoticeDate, captainsNoticeDate } = calculateScheduleNoticeTimes(match.fecha)

      // Verificar si corresponde avisar al árbitro
      if (!match.referee_notified_at && (now.isAfter(refereeNoticeDate) || now.isSame(refereeNoticeDate, 'minute'))) {
        await notifyReferee(match)
        notifiedReferees++
      }

      // Verificar si corresponde avisar a capitanes
      if (!match.captains_notified_at && (now.isAfter(captainsNoticeDate) || now.isSame(captainsNoticeDate, 'minute'))) {
        await notifyCaptains(match)
        notifiedCaptains++
      }
    }

    // Verificar árbitros que no han confirmado dentro del lapso
    const alerts = await checkRefereeConfirmations()

    return {
      evaluatedMatches: matches.length,
      notifiedReferees,
      notifiedCaptains,
      alertsGenerated: alerts.length,
    }
  } catch (error) {
    console.error('[Schedule] Error procesando notificaciones programadas:', error)
    return { error: error.message }
  }
}
