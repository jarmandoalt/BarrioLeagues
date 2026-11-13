import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import { League } from '../models/League.js'
import { LeagueAdminCredential } from '../models/LeagueAdminCredential.js'
import { Team } from '../models/Team.js'
import { Court } from '../models/Court.js'
import { Referee } from '../models/Referee.js'
import { Match } from '../models/Match.js'
import { createRoundRobinFixtures, assignFixtureSchedules, calcularFechasJornadas } from '../services/leagueScheduleGenerator.js'
import {
  adminCookieName,
  getAdminCookieOptions,
  isAdminAuthConfigured,
  readAdminSession,
  requireTrustedOrigin,
} from '../services/adminAuth.js'

export const adminAuthRoutes = Router()

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' },
})
const leagueAdminResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Demasiadas solicitudes. Intenta más tarde.' },
})

const issueSession = (res, claims) => {
  const token = jwt.sign(claims, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    issuer: 'barrioleagues',
    audience: 'barrioleagues-admin',
    expiresIn: process.env.ADMIN_SESSION_TTL || '8h',
  })
  res.cookie(adminCookieName, token, getAdminCookieOptions())
}

const isValidNewPassword = (password) => typeof password === 'string' && password.length >= 8 && password.length <= 1024
const getMustConfigureLeague = (credential) => credential.mustConfigureLeague ?? credential.mustChangePassword
const wizardFormats = {
  TIPO_1: 'LIGA_IDA_VUELTA',
  TIPO_2: 'LIGA_UNA_VUELTA',
  TIPO_3: 'LIGA_IDA_VUELTA_CON_LIGUILLA_8',
  TIPO_4: 'LIGA_UNA_VUELTA_CON_LIGUILLA_8',
}
const wizardDays = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
const getScheduleConflictIndex = (schedules, durationMinutes) => {
  let lastConflict = -1
  schedules.forEach((schedule, index) => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.horaInicio || '')) return
    const [hours, minutes] = schedule.horaInicio.split(':').map(Number)
    const start = (hours * 60) + minutes
    const conflicts = schedules.slice(0, index).some((previous) => {
      if (previous.dia !== schedule.dia || !/^([01]\d|2[0-3]):[0-5]\d$/.test(previous.horaInicio || '')) return false
      const [previousHours, previousMinutes] = previous.horaInicio.split(':').map(Number)
      return Math.abs(start - ((previousHours * 60) + previousMinutes)) < durationMinutes
    })
    if (conflicts) lastConflict = index
  })
  return lastConflict
}
const requireWizardSession = async (req, res) => {
  const slug = req.params.slug.toLowerCase()
  const session = readAdminSession(req)
  if (!session || session.role !== 'league-admin' || session.leagueSlug !== slug) {
    res.status(401).json({ message: 'Inicia sesión como administrador de esta liga para continuar' })
    return null
  }
  const credential = await LeagueAdminCredential.findOne({ leagueSlug: slug })
  if (!credential) {
    res.status(404).json({ message: 'Cuenta de liga no encontrada' })
    return null
  }
  if (credential.mustChangePassword) {
    res.status(403).json({ message: 'Primero debes cambiar la contraseña inicial' })
    return null
  }
  if (!getMustConfigureLeague(credential)) {
    res.status(409).json({ message: 'La configuración inicial de la liga ya fue completada' })
    return null
  }
  return { slug, credential }
}
const getAvailableMatchId = (usedIds) => {
  for (let number = 100000; number <= 999999; number += 1) {
    const id = String(number)
    if (new Set(id).size === 6 && !usedIds.has(id)) {
      usedIds.add(id)
      return id
    }
  }
  return ''
}

adminAuthRoutes.get('/admin/session', async (req, res) => {
  const session = readAdminSession(req)
  const authenticated = Boolean(session && (
    (session.role === 'superadmin' && session.sub === process.env.ADMIN_USERNAME)
    || (session.role === 'league-admin' && session.leagueSlug === session.sub)
  ))
  let mustChangePassword = authenticated && Boolean(session.mustChangePassword)
  let mustConfigureLeague = false
  if (authenticated && session.role === 'league-admin') {
    const credential = await LeagueAdminCredential.findOne({ leagueSlug: session.leagueSlug }).select('mustChangePassword mustConfigureLeague')
    mustChangePassword = !credential || credential.mustChangePassword
    mustConfigureLeague = Boolean(credential && getMustConfigureLeague(credential))
  }
  return res.json({
    configured: isAdminAuthConfigured(),
    authenticated,
    role: authenticated ? session.role : null,
    leagueSlug: authenticated ? session.leagueSlug || null : null,
    mustChangePassword,
    mustConfigureLeague,
  })
})

adminAuthRoutes.post('/admin/login', loginLimiter, requireTrustedOrigin, async (req, res) => {
  if (!isAdminAuthConfigured()) {
    return res.status(503).json({ message: 'El acceso administrativo no está configurado. Ejecuta npm run admin:setup en el servidor.' })
  }

  const { username, password } = req.body || {}
  if (typeof username !== 'string' || typeof password !== 'string' || password.length > 1024) {
    return res.status(400).json({ message: 'Usuario o contraseña inválidos' })
  }

  const passwordMatches = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH)
  if (username.trim().toLowerCase() !== process.env.ADMIN_USERNAME.toLowerCase() || !passwordMatches) {
    return res.status(401).json({ message: 'Usuario o contraseña incorrectos' })
  }

  issueSession(res, { sub: process.env.ADMIN_USERNAME, role: 'superadmin' })
  return res.json({ authenticated: true })
})

adminAuthRoutes.post('/ligas/:slug/admin/login', loginLimiter, requireTrustedOrigin, async (req, res) => {
  const slug = req.params.slug.toLowerCase()
  const { username, password } = req.body || {}
  if (username !== slug || typeof password !== 'string' || password.length > 1024) {
    return res.status(401).json({ message: 'Usuario o contraseña incorrectos' })
  }

  const credential = await LeagueAdminCredential.findOne({ leagueSlug: slug }).select('+passwordHash mustChangePassword mustConfigureLeague')
  if (!credential) return res.status(401).json({ message: 'Usuario o contraseña incorrectos' })
  const passwordMatches = await bcrypt.compare(password, credential.passwordHash)
  if (!passwordMatches) return res.status(401).json({ message: 'Usuario o contraseña incorrectos' })

  issueSession(res, {
    sub: slug,
    role: 'league-admin',
    leagueSlug: slug,
    mustChangePassword: credential.mustChangePassword,
  })
  return res.json({
    authenticated: true,
    mustChangePassword: credential.mustChangePassword,
    mustConfigureLeague: getMustConfigureLeague(credential),
  })
})

adminAuthRoutes.post('/ligas/:slug/admin/password', requireTrustedOrigin, async (req, res) => {
  const slug = req.params.slug.toLowerCase()
  const session = readAdminSession(req)
  if (!session || session.role !== 'league-admin' || session.leagueSlug !== slug) {
    return res.status(401).json({ message: 'Inicia sesión en esta liga para cambiar la contraseña' })
  }

  const { password } = req.body || {}
  if (!isValidNewPassword(password)) {
    return res.status(400).json({ message: 'La contraseña debe tener entre 8 y 1024 caracteres' })
  }
  if (password.toLowerCase() === slug) {
    return res.status(400).json({ message: 'La contraseña nueva debe ser distinta al usuario de la liga' })
  }

  const credential = await LeagueAdminCredential.findOne({ leagueSlug: slug }).select('+passwordHash')
  if (!credential) return res.status(404).json({ message: 'Cuenta de liga no encontrada' })

  credential.passwordHash = await bcrypt.hash(password, 12)
  credential.mustChangePassword = false
  await credential.save()

  issueSession(res, { sub: slug, role: 'league-admin', leagueSlug: slug, mustChangePassword: false })
  return res.json({ passwordChanged: true, mustConfigureLeague: getMustConfigureLeague(credential) })
})

adminAuthRoutes.put('/ligas/:slug/admin/wizard/config', requireTrustedOrigin, async (req, res) => {
  const access = await requireWizardSession(req, res)
  if (!access) return
  const { slug } = access
  const config = req.body || {}
  if (!wizardFormats[config.formatoLiga]) return res.status(400).json({ message: 'Selecciona uno de los cuatro formatos de liga' })
  if (!Number.isInteger(config.duracionPartidoMin) || config.duracionPartidoMin < 10 || config.duracionPartidoMin > 240) {
    return res.status(400).json({ message: 'La duración debe ser un número entero entre 10 y 240 minutos' })
  }
  if (!Array.isArray(config.diasJuego) || config.diasJuego.length === 0
    || config.diasJuego.some((day) => !wizardDays.includes(day))
    || new Set(config.diasJuego).size !== config.diasJuego.length) {
    return res.status(400).json({ message: 'Selecciona al menos un día de juego válido' })
  }
  if (!wizardDays.includes(config.cambioDeJornada)
    && !['cada_lunes', 'al_terminar_partidos'].includes(config.cambioDeJornada)) {
    return res.status(400).json({ message: 'Selecciona cuándo cambiar la jornada' })
  }
  if (!wizardDays.includes(config.diaEntregaInfo?.dia)
    || typeof config.diaEntregaInfo?.hora !== 'string'
    || !/^([01]\d|2[0-3]):[0-5]\d$/.test(config.diaEntregaInfo.hora)) {
    return res.status(400).json({ message: 'Indica un día y hora válidos para entregar la información' })
  }
  const parsedStartDate = typeof config.fechaInicioLiga === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(config.fechaInicioLiga)
    ? new Date(`${config.fechaInicioLiga}T12:00:00Z`)
    : null
  if (!parsedStartDate || Number.isNaN(parsedStartDate.getTime())
    || parsedStartDate.toISOString().slice(0, 10) !== config.fechaInicioLiga) {
    return res.status(400).json({ message: 'Selecciona una fecha de inicio válida' })
  }
  if (config.fechaInicioLiga < new Date().toISOString().slice(0, 10)) {
    return res.status(400).json({ message: 'La fecha de inicio no puede estar en el pasado' })
  }
  const weekDay = wizardDays[(new Date(`${config.fechaInicioLiga}T12:00:00Z`).getUTCDay() + 6) % 7]
  if (!config.diasJuego.includes(weekDay)) return res.status(400).json({ message: 'La fecha de inicio debe coincidir con uno de los días de juego' })
  if (config.tipoInicioLiga !== 'desde_cero') {
    return res.status(400).json({ message: 'La opción de liga ya empezada estará disponible próximamente' })
  }

  const league = await League.findOne({ slug })
  if (!league) return res.status(404).json({ message: 'Liga no encontrada' })
  const updatedConfig = {
    formatoLiga: config.formatoLiga,
    duracionPartidoMin: config.duracionPartidoMin,
    diasJuego: config.diasJuego,
    cambioDeJornada: config.cambioDeJornada,
    diaEntregaInfo: config.diaEntregaInfo,
    fechaInicioLiga: config.fechaInicioLiga,
    tipoInicioLiga: 'desde_cero',
    pasoWizard: 2,
  }
  league.config = updatedConfig
  league.formatoTorneo = wizardFormats[config.formatoLiga]
  league.duracionPartido = config.duracionPartidoMin
  league.actualizacionJornada = wizardDays.includes(config.cambioDeJornada)
    ? config.cambioDeJornada
    : config.cambioDeJornada === 'cada_lunes' ? 'lunes' : weekDay
  league.avisoPartidosDia = config.diaEntregaInfo.dia
  league.avisoPartidosHora = config.diaEntregaInfo.hora
  await league.save()
  return res.json({ saved: true, pasoWizard: 2 })
})

adminAuthRoutes.post('/ligas/:slug/admin/wizard/progress', requireTrustedOrigin, async (req, res) => {
  const access = await requireWizardSession(req, res)
  if (!access) return
  const step = Number(req.body?.step)
  if (!Number.isInteger(step) || step < 1 || step > 5) {
    return res.status(400).json({ message: 'El paso del asistente debe estar entre 1 y 5' })
  }
  const leagueData = await League.findOne({ slug: access.slug }).select('config')
  if (!leagueData) return res.status(404).json({ message: 'Liga no encontrada' })
  if (step >= 2 && !leagueData.config?.fechaInicioLiga) {
    return res.status(409).json({ message: 'Completa primero la configuración del torneo' })
  }
  if (step >= 3 && await Team.countDocuments({ ligaId: access.slug }) < 4) {
    return res.status(409).json({ message: 'Registra al menos 4 equipos para continuar' })
  }
  if (step >= 4 && await Court.countDocuments({ liga_id: access.slug, estado: 'activa' }) < 1) {
    return res.status(409).json({ message: 'Registra al menos una cancha para continuar' })
  }
  if (step >= 5 && await Referee.countDocuments({ liga_id: access.slug, estado: 'activo' }) < 1) {
    return res.status(409).json({ message: 'Registra al menos un árbitro para continuar' })
  }
  const league = await League.findOneAndUpdate(
    { slug: access.slug },
    { $set: { 'config.pasoWizard': step } },
    { new: true, runValidators: true },
  )
  if (!league) return res.status(404).json({ message: 'Liga no encontrada' })
  return res.json({ saved: true, pasoWizard: step })
})

adminAuthRoutes.post('/ligas/:slug/admin/wizard/teams', requireTrustedOrigin, async (req, res) => {
  const access = await requireWizardSession(req, res)
  if (!access) return
  const count = await Team.countDocuments({ ligaId: access.slug })
  if (count >= 24) return res.status(409).json({ message: 'Una liga puede tener como máximo 24 equipos' })
  try {
    const team = await Team.create({ ...req.body, ligaId: access.slug })
    return res.status(201).json(team)
  } catch (error) {
    return res.status(400).json({ message: 'No se pudo crear el equipo', error: error.message })
  }
})

adminAuthRoutes.post('/ligas/:slug/admin/wizard/courts', requireTrustedOrigin, async (req, res) => {
  const access = await requireWizardSession(req, res)
  if (!access) return
  const league = await League.findOne({ slug: access.slug }).select('config.diasJuego duracionPartido')
  if (!league) return res.status(404).json({ message: 'Liga no encontrada' })
  const schedules = req.body.horarios
  if (!Array.isArray(schedules) || schedules.length === 0
    || schedules.some((item) => !league.config.diasJuego.includes(item.dia))) {
    return res.status(400).json({ message: 'Agrega al menos un horario en los días de juego seleccionados' })
  }
  const conflictIndex = getScheduleConflictIndex(schedules, league.duracionPartido || 60)
  if (conflictIndex >= 0) {
    return res.status(409).json({
      message: `El horario ${schedules[conflictIndex].horaInicio} se empalma con otro horario de esta cancha.`,
      conflictIndex,
    })
  }
  try {
    const court = await Court.create({ nombre: req.body.nombre, liga_id: access.slug, horarios: schedules, estado: 'activa' })
    return res.status(201).json(court)
  } catch (error) {
    return res.status(400).json({ message: 'No se pudo crear la cancha', error: error.message })
  }
})

adminAuthRoutes.post('/ligas/:slug/admin/wizard/referees', requireTrustedOrigin, async (req, res) => {
  const access = await requireWizardSession(req, res)
  if (!access) return
  try {
    const referee = await Referee.create({
      nombre: req.body.nombre,
      telefono: req.body.whatsapp,
      liga_id: access.slug,
      estado: 'activo',
    })
    return res.status(201).json(referee)
  } catch (error) {
    return res.status(400).json({ message: 'No se pudo crear el árbitro', error: error.message })
  }
})

adminAuthRoutes.post('/ligas/:slug/admin/wizard/complete', requireTrustedOrigin, async (req, res) => {
  const access = await requireWizardSession(req, res)
  if (!access) return
  const { slug, credential } = access
  try {
    const league = await League.findOne({ slug })
    if (!league?.config?.fechaInicioLiga) return res.status(409).json({ message: 'Guarda primero la configuración del torneo' })
    const [teams, courts, referees, existingMatches] = await Promise.all([
      Team.find({ ligaId: slug }).sort({ nombre: 1 }),
      Court.find({ liga_id: slug, estado: 'activa' }),
      Referee.find({ liga_id: slug, estado: 'activo' }),
      Match.find({ liga_id: slug }),
    ])
    if (teams.length < 4 || teams.length > 24) return res.status(400).json({ message: 'Registra entre 4 y 24 equipos para continuar' })
    if (league.config.formatoLiga === 'TIPO_3' || league.config.formatoLiga === 'TIPO_4') {
      if (teams.length < 8) return res.status(400).json({ message: 'Los formatos con liguilla de 8 requieren al menos 8 equipos' })
    }
    if (courts.length === 0) return res.status(400).json({ message: 'Registra al menos una cancha activa' })
    if (referees.length === 0) return res.status(400).json({ message: 'Registra al menos un árbitro activo' })
    if (existingMatches.length > 0) return res.status(409).json({ message: 'Ya existen partidos; no se puede generar el calendario inicial otra vez' })

    const startDate = league.config.fechaInicioLiga
    if (startDate < new Date().toISOString().slice(0, 10)) {
      return res.status(400).json({ message: 'La fecha de inicio ya está en el pasado; actualiza el Paso 1.', step: 1 })
    }
    const format = wizardFormats[league.config.formatoLiga]
    const regularRounds = teams.length % 2 === 0 ? teams.length - 1 : teams.length
    const totalJornadas = format.includes('IDA_VUELTA') ? regularRounds * 2 : regularRounds
    const allJourneyDates = calcularFechasJornadas(
      startDate,
      league.config.diasJuego,
      league.config.cambioDeJornada,
      totalJornadas + 1,
    )
    const fechasJornadas = allJourneyDates.slice(0, totalJornadas)
    const matchesPerRound = Math.floor(teams.length / 2)
    const firstJourneyStart = allJourneyDates[0].fecha
    const nextJourneyStart = allJourneyDates[1].fecha
    let availableSlots = 0
    for (let date = firstJourneyStart; date < nextJourneyStart;) {
      const weekday = wizardDays[(new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7]
      availableSlots += courts.reduce((total, court) => {
        const startTimes = (court.horarios || [])
          .filter((schedule) => schedule.dia === weekday)
          .map((schedule) => {
            const [hours, minutes] = schedule.horaInicio.split(':').map(Number)
            return (hours * 60) + minutes
          })
          .sort((first, second) => first - second)
        let count = 0
        let nextAvailable = -1
        startTimes.forEach((time) => {
          if (time < nextAvailable) return
          count += 1
          nextAvailable = time + league.duracionPartido
        })
        return total + count
      }, 0)
      const [year, month, day] = date.split('-').map(Number)
      date = new Date(Date.UTC(year, month - 1, day + 1, 12)).toISOString().slice(0, 10)
    }
    if (availableSlots < matchesPerRound) {
      return res.status(400).json({
        message: `No hay capacidad para la jornada 1 entre ${firstJourneyStart} y ${nextJourneyStart}: se requieren ${matchesPerRound} horarios sin empalmes y solo hay ${availableSlots}.`,
        step: 3,
      })
    }

    const generationMode = req.body?.modoGeneracion
    if (!['automatico', 'manual'].includes(generationMode)) {
      return res.status(400).json({ message: 'Selecciona asignación automática o manual para generar el calendario.' })
    }
    const allFixtures = createRoundRobinFixtures({
      teams,
      existingMatches: [],
      currentJourney: 0,
      format,
    })
    const autoAssign = generationMode === 'automatico'
    const scheduledMatches = assignFixtureSchedules({
      fixtures: allFixtures,
      existingMatches: [],
      courts,
      referees,
      durationMinutes: league.duracionPartido,
      journeyDates: allJourneyDates,
      assign: autoAssign
        ? { arbitro: true, cancha: true, horario: true }
        : { arbitro: false, cancha: false, horario: false },
      startDate,
      startTime: '',
      requireRefereeAvailability: autoAssign,
    })

    const usedIds = new Set()
    const matchDocuments = scheduledMatches.map((match) => ({
      ...match,
      arbitro_id: autoAssign ? match.arbitro_id : null,
      cancha_id: autoAssign ? match.cancha_id : null,
      fecha: autoAssign ? match.fecha : null,
      hora: autoAssign ? match.hora : null,
      idPartido: getAvailableMatchId(usedIds),
      liga_id: slug,
      faseTorneo: 'regular',
      marcadorLocal: 0,
      marcadorVisitante: 0,
      eventos: [],
    }))
    if (matchDocuments.some((match) => !match.idPartido)) return res.status(409).json({ message: 'No quedan identificadores disponibles para crear los partidos.' })
    await Match.insertMany(matchDocuments)

    league.jornada = 1
    league.estado = 'activa'
    league.wizardCompletado = true
    league.fechaProgramada = new Date(`${startDate}T12:00:00`)
    league.config.pasoWizard = 5
    league.config.fechasJornadas = fechasJornadas
    await league.save()
    credential.mustConfigureLeague = false
    await credential.save()
    return res.status(201).json({ completed: true, count: matchDocuments.length, totalJornadas, league })
  } catch (error) {
    return res.status(400).json({ message: error.message || 'No se pudo generar el calendario.', step: 3 })
  }
})

adminAuthRoutes.post('/ligas/:slug/admin/configuracion-inicial', requireTrustedOrigin, async (req, res) => {
  const slug = req.params.slug.toLowerCase()
  const session = readAdminSession(req)
  if (!session || session.role !== 'league-admin' || session.leagueSlug !== slug) {
    return res.status(401).json({ message: 'Inicia sesión como administrador de esta liga para configurarla' })
  }
  return res.status(409).json({ message: 'Completa todos los pasos del asistente inicial de la liga.' })
})

adminAuthRoutes.post('/admin/ligas/:slug/reset-password', leagueAdminResetLimiter, requireTrustedOrigin, async (req, res) => {
  const session = readAdminSession(req)
  if (!session || session.role !== 'superadmin' || session.sub !== process.env.ADMIN_USERNAME) {
    return res.status(401).json({ message: 'Solo el administrador general puede resetear contraseñas de liga' })
  }

  const slug = req.params.slug.toLowerCase()
  const { slugConfirmation, adminPassword } = req.body || {}
  if (slugConfirmation !== slug) {
    return res.status(400).json({ message: 'El slug de confirmación no coincide' })
  }
  if (typeof adminPassword !== 'string' || adminPassword.length > 1024) {
    return res.status(400).json({ message: 'Debes confirmar la contraseña del administrador general' })
  }
  if (!isAdminAuthConfigured() || !await bcrypt.compare(adminPassword, process.env.ADMIN_PASSWORD_HASH)) {
    return res.status(401).json({ message: 'La contraseña del administrador general es incorrecta' })
  }

  const [league, credential] = await Promise.all([
    League.findOne({ slug }).select('_id'),
    LeagueAdminCredential.findOne({ leagueSlug: slug }).select('+passwordHash'),
  ])
  if (!league || !credential) return res.status(404).json({ message: 'No se encontró la cuenta de esa liga' })

  credential.passwordHash = await bcrypt.hash(slug, 12)
  credential.mustChangePassword = true
  await credential.save()
  return res.json({ reset: true, username: slug, mustChangePassword: true })
})

adminAuthRoutes.post('/admin/logout', requireTrustedOrigin, (req, res) => {
  res.clearCookie(adminCookieName, getAdminCookieOptions())
  return res.status(204).end()
})

adminAuthRoutes.get('/ligas/:slug/admin-contact', async (req, res) => {
  const slug = req.params.slug.toLowerCase()
  const session = readAdminSession(req)
  const isSuperAdmin = session?.role === 'superadmin' && session.sub === process.env.ADMIN_USERNAME
  const isThisLeagueAdmin = session?.role === 'league-admin' && session.leagueSlug === slug
  if (!isSuperAdmin && !isThisLeagueAdmin) {
    return res.status(401).json({ message: 'Inicia sesión con permisos para esta liga' })
  }

  const league = await League.findOne({ slug }).select('dueno.email').lean()
  if (!league) return res.status(404).json({ message: 'Liga no encontrada' })
  return res.json({ email: league.dueno?.email || '' })
})