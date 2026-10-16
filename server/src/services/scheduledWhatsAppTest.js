import { League } from '../models/League.js'
import { Match } from '../models/Match.js'
import { normalizeWhatsAppPhone, sendMatchTemplate } from './whatsappCloudService.js'

const weekdays = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const leagueSlug = 'las-huertas'
const checkIntervalMs = 10_000
let isChecking = false

export const getDueScheduleDate = (league, now = new Date()) => {
  const day = weekdays[now.getDay()]
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  if (day !== league.avisoPartidosDia || time !== league.avisoPartidosHora) return ''
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const sendScheduledMessages = async (league, recipientPhone) => {
  const matches = await Match.find({ liga_id: league.slug, jornada: league.jornada, estado: 'programado' })
    .populate('equipoLocal_id', 'nombre')
    .populate('equipoVisitante_id', 'nombre')
    .populate('cancha_id', 'nombre')
    .sort({ fecha: 1, hora: 1 })

  if (matches.length === 0) {
    console.log(`Aviso programado omitido: no hay partidos pendientes para ${league.slug}, jornada ${league.jornada}.`)
    return
  }

  for (const match of matches) {
    const localTeam = match.equipoLocal_id?.nombre || 'Equipo local'
    const visitorTeam = match.equipoVisitante_id?.nombre || 'Equipo visitante'
    const date = match.fecha
      ? new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(match.fecha)
      : 'fecha por confirmar'
    const time = match.hora || 'hora por confirmar'
    const court = match.cancha_id?.nombre || 'cancha por confirmar'

    try {
      const result = await sendMatchTemplate({
        phoneNumber: recipientPhone,
        recipientName: 'Prueba BarrioLeagues',
        localTeam,
        visitorTeam,
        date,
        time,
        court,
        leagueName: league.nombre,
        jornada: league.jornada,
      })
      console.log(`Aviso programado aceptado para ${league.slug}, jornada ${league.jornada}: ${result.status}.`)
    } catch (error) {
      console.error(`Falló el aviso programado para ${league.slug}, jornada ${league.jornada}: ${error.message}`)
    }
  }
}

const checkScheduledTest = async () => {
  if (isChecking) return
  isChecking = true

  try {
    const league = await League.findOne({ slug: leagueSlug }).select('+avisoPartidosUltimoEnvio')
    if (!league) return

    const dateKey = getDueScheduleDate(league)
    if (!dateKey || league.avisoPartidosUltimoEnvio === dateKey) return

    const recipientPhone = normalizeWhatsAppPhone(process.env.WHATSAPP_SCHEDULED_TEST_PHONE)
    if (!/^\d{8,15}$/.test(recipientPhone)) {
      console.error('Aviso programado deshabilitado: WHATSAPP_SCHEDULED_TEST_PHONE no está configurado correctamente.')
      return
    }

    const pendingMatches = await Match.exists({ liga_id: league.slug, jornada: league.jornada, estado: 'programado' })
    if (!pendingMatches) {
      console.log(`Aviso programado omitido: no hay partidos pendientes para ${league.slug}, jornada ${league.jornada}.`)
      return
    }

    const claimedLeague = await League.findOneAndUpdate(
      { _id: league._id, avisoPartidosUltimoEnvio: { $ne: dateKey } },
      { $set: { avisoPartidosUltimoEnvio: dateKey } },
      { new: true },
    )
    if (!claimedLeague) return

    await sendScheduledMessages(league, recipientPhone)
  } catch (error) {
    console.error(`No se pudo procesar el aviso programado para ${leagueSlug}: ${error.message}`)
  } finally {
    isChecking = false
  }
}

export const startScheduledWhatsAppTest = () => {
  const recipientPhone = normalizeWhatsAppPhone(process.env.WHATSAPP_SCHEDULED_TEST_PHONE)
  if (!/^\d{8,15}$/.test(recipientPhone)) {
    console.warn('Aviso programado de prueba inactivo: configura WHATSAPP_SCHEDULED_TEST_PHONE.')
    return
  }

  void checkScheduledTest()
  const interval = setInterval(checkScheduledTest, checkIntervalMs)
  interval.unref()
}