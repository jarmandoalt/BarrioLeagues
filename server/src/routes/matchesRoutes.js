import { Router } from 'express'
import mongoose from 'mongoose'
import { Match } from '../models/Match.js'
import { Team } from '../models/Team.js'
import { Referee } from '../models/Referee.js'
import { Court } from '../models/Court.js'
import { League } from '../models/League.js'
import { findOverlappingMatch } from '../services/matchScheduling.js'
import { recalculateTeamStats } from '../services/matchStats.js'
import { advanceLeaguePlayoffs, validateFinalLeg } from '../services/leagueTournament.js'
import { assignFixtureSchedules, createRoundRobinFixtures, isDoubleRoundRobinFormat } from '../services/leagueScheduleGenerator.js'
import { requireAdminAuth } from '../services/adminAuth.js'
import { confirmarReasignaciones, getRecursosDisponibles, inspectMoveCandidate } from '../services/calendarRescheduling.js'

export const matchesRoutes = Router()

const isValidMatchId = (value) => typeof value === 'string' && /^[0-9]{6}$/.test(value) && new Set(value).size === 6

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

const getSchedulingError = async (body, ligaId, courtId, excludeId) => {
  if (!body.fecha || !courtId) return null
  const startsAt = new Date(body.fecha)
  if (Number.isNaN(startsAt.getTime())) return { status: 400, message: 'La fecha del partido no es válida' }
  if (body.estado === 'suspendido') return null

  const overlap = await findOverlappingMatch({ ligaId, courtId, startsAt, excludeId })
  if (!overlap) return null
  return { status: 409, message: `La cancha ya tiene un partido a las ${overlap.hora} que se empalma con este horario` }
}

const requireDatabase = (res) => {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ message: 'MongoDB no está conectado' })
    return false
  }

  return true
}

const populateMatch = (query) => query
  .populate('equipoLocal_id', 'nombre nombreCorto')
  .populate('equipoVisitante_id', 'nombre nombreCorto')
  .populate('arbitro_id', 'nombre telefono')
  .populate('cancha_id', 'nombre')

matchesRoutes.get('/ligas/:slug/jornadas/:jornada/recursos-disponibles', requireAdminAuth, async (req, res) => {
  if (!requireDatabase(res)) return
  try {
    const excluding = String(req.query.excluir || '').split(',').filter(Boolean)
    const resources = await getRecursosDisponibles(
      req.params.jornada,
      req.query.fechaHora,
      req.query.partidoIgnorado,
      {
        ligaId: req.params.slug.toLowerCase(),
        hora: req.query.hora,
        dia: req.query.dia,
        excluirPartidoIds: excluding,
      },
    )
    return res.json(resources)
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || 'No se pudieron consultar los recursos.' })
  }
})

matchesRoutes.post('/ligas/:slug/partidos/:partidoId/reasignar/evaluar', async (req, res) => {
  if (!requireDatabase(res)) return
  try {
    const result = await inspectMoveCandidate({
      ligaId: req.params.slug.toLowerCase(),
      partidoId: req.params.partidoId,
      jornada: req.body?.jornada,
      fechaHora: req.body?.fechaHora,
      hora: req.body?.hora,
      dia: req.body?.dia,
      canchaId: req.body?.canchaId,
      arbitroId: req.body?.arbitroId,
      excluirPartidoIds: req.body?.excluirPartidoIds || [],
    })
    return res.json(result)
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || 'No se pudo evaluar el nuevo horario.' })
  }
})

matchesRoutes.post('/ligas/:slug/partidos/reasignar/confirmar', async (req, res) => {
  if (!requireDatabase(res)) return
  try {
    const matches = await confirmarReasignaciones({
      ligaId: req.params.slug.toLowerCase(),
      movimientos: req.body?.movimientos,
      operador: req.admin?.username || 'administrador',
    })
    return res.json({ matches })
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message || 'No se pudieron confirmar las reasignaciones.' })
  }
})

matchesRoutes.get('/partidos', async (req, res) => {
  if (!requireDatabase(res)) return

  try {
    const matches = await populateMatch(
      Match.find(req.query.slug ? { liga_id: req.query.slug.toLowerCase() } : {}).sort({ jornada: 1 }),
    )
    return res.json(matches)
  } catch (error) {
    return res.status(500).json({ message: 'No se pudieron consultar los partidos', error: error.message })
  }
})

matchesRoutes.post('/ligas/:slug/partidos/generar', async (req, res) => {
  if (!requireDatabase(res)) return

  try {
    const ligaId = req.params.slug.toLowerCase()
    const league = await League.findOne({ slug: ligaId }).select('jornada formatoTorneo duracionPartido config')
    if (!league) return res.status(404).json({ message: 'Liga no encontrada' })

    const assign = Object.fromEntries(['arbitro', 'cancha', 'horario'].map((key) => [key, req.body?.asignar?.[key] === true]))
    const [teams, existingMatches, courts, referees] = await Promise.all([
      Team.find({ ligaId }).sort({ nombre: 1 }),
      Match.find({ liga_id: ligaId }).select('idPartido equipoLocal_id equipoVisitante_id arbitro_id cancha_id jornada fecha estado faseTorneo'),
      Court.find({ liga_id: ligaId, estado: 'activa' }),
      Referee.find({ liga_id: ligaId, estado: 'activo' }),
    ])
    const fixtures = createRoundRobinFixtures({
      teams,
      existingMatches,
      currentJourney: existingMatches.length === 0 ? 0 : league.jornada ?? 0,
      format: league.formatoTorneo || 'todos-vs-todos-una-vuelta',
    })
    if (fixtures.length === 0) return res.json({ count: 0, matches: [] })

    const scheduledMatches = assignFixtureSchedules({
      fixtures,
      existingMatches,
      courts,
      referees,
      durationMinutes: league.duracionPartido || 60,
      assign,
      startDate: league.config?.fechaInicioLiga,
      startTime: league.config?.horaInicioLiga,
      journeyDates: league.config?.fechasJornadas,
    })
    const usedIds = new Set(existingMatches.map((match) => match.idPartido))
    const matchDocuments = scheduledMatches.map((match) => ({
      ...match,
      idPartido: getAvailableMatchId(usedIds),
      liga_id: ligaId,
      faseTorneo: 'regular',
      marcadorLocal: 0,
      marcadorVisitante: 0,
      eventos: [],
    }))

    if (matchDocuments.some((match) => !match.idPartido)) {
      return res.status(409).json({ message: 'No quedan identificadores disponibles para crear los partidos.' })
    }

    const createdMatches = await Match.insertMany(matchDocuments)
    const populatedMatches = await populateMatch(Match.find({ _id: { $in: createdMatches.map((match) => match._id) } }).sort({ jornada: 1, fecha: 1 }))
    return res.status(201).json({ count: populatedMatches.length, matches: populatedMatches })
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'No se pudieron generar partidos duplicados en esta liga.' })
    return res.status(400).json({ message: error.message || 'No se pudieron generar los partidos automáticamente.' })
  }
})

matchesRoutes.post('/partidos', async (req, res) => {
  if (!requireDatabase(res)) return

  try {
    const ligaId = req.body.liga_id?.toLowerCase()
    if (!/^[0-9]{6}$/.test(req.body.idPartido || '')) {
      return res.status(400).json({ message: 'El ID del partido debe tener exactamente seis dígitos' })
    }

    const { equipoLocal_id: localId, equipoVisitante_id: visitaId } = req.body
    const teams = await Team.find({ _id: { $in: [localId, visitaId] }, ligaId })
    const referee = await Referee.findOne({ _id: req.body.arbitro_id, liga_id: ligaId, estado: 'activo' })
    const court = await Court.findOne({ _id: req.body.cancha_id, liga_id: ligaId, estado: 'activa' })

    if (teams.length !== 2) {
      return res.status(400).json({ message: 'Los dos equipos deben existir en la liga seleccionada' })
    }

    if (req.body.arbitro_id && !referee) {
      return res.status(400).json({ message: 'El árbitro debe existir y estar activo en la liga seleccionada' })
    }
    if (req.body.cancha_id && !court) return res.status(400).json({ message: 'La cancha debe existir y estar activa en la liga seleccionada' })

    const schedulingError = await getSchedulingError(req.body, ligaId, court?._id)
    if (schedulingError) return res.status(schedulingError.status).json({ message: schedulingError.message })

    const match = await Match.create({ ...req.body, liga_id: ligaId })

    if (match.estado === 'finalizado') {
      await recalculateTeamStats([localId, visitaId])
    }

    const torneoAviso = match.estado === 'finalizado' ? await advanceLeaguePlayoffs(ligaId) : ''
    const populatedMatch = await populateMatch(Match.findById(match._id))
    return res.status(201).json({ ...(await populatedMatch).toObject(), ...(torneoAviso && { torneoAviso }) })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Ese ID ya está en uso en esta liga' })
    }
    return res.status(400).json({ message: 'No se pudo crear el partido', error: error.message })
  }
})

matchesRoutes.put('/partidos/:id', async (req, res) => {
  if (!requireDatabase(res)) return

  try {
    const ligaId = req.body.liga_id?.toLowerCase()
    if (!isValidMatchId(req.body.idPartido)) {
      return res.status(400).json({ message: 'El ID del partido debe tener seis dígitos diferentes' })
    }

    const { equipoLocal_id: localId, equipoVisitante_id: visitaId } = req.body
    const teams = await Team.find({ _id: { $in: [localId, visitaId] }, ligaId })
    const referee = await Referee.findOne({ _id: req.body.arbitro_id, liga_id: ligaId, estado: 'activo' })
    const court = await Court.findOne({ _id: req.body.cancha_id, liga_id: ligaId, estado: 'activa' })

    if (teams.length !== 2) return res.status(400).json({ message: 'Los dos equipos deben existir en la liga seleccionada' })
    if (req.body.arbitro_id && !referee) return res.status(400).json({ message: 'El árbitro debe existir y estar activo en la liga seleccionada' })
    if (req.body.cancha_id && !court) return res.status(400).json({ message: 'La cancha debe existir y estar activa en la liga seleccionada' })

    const schedulingError = await getSchedulingError(req.body, ligaId, court?._id, req.params.id)
    if (schedulingError) return res.status(schedulingError.status).json({ message: schedulingError.message })

    const existingMatch = await Match.findOne({ _id: req.params.id, liga_id: ligaId })
    if (!existingMatch) return res.status(404).json({ message: 'Partido no encontrado' })

    const downstreamPhases = {
      cuartos: ['semifinal', 'final'],
      semifinal: ['final'],
    }[existingMatch.faseTorneo]
    if (downstreamPhases?.length) {
      const downstreamMatch = await Match.findOne({
        liga_id: ligaId,
        faseTorneo: { $in: downstreamPhases },
      }).select('_id')
      const resultChanged = ['marcadorLocal', 'marcadorVisitante', 'estado'].some((field) => (
        req.body[field] !== undefined && req.body[field] !== existingMatch[field]
      ))
      if (downstreamMatch && resultChanged) {
        return res.status(409).json({ message: 'No se puede cambiar este resultado después de generar la siguiente fase de liguilla.' })
      }
    }

    if (existingMatch.faseTorneo === 'final' && existingMatch.partidoSerie === 2) {
      const firstLeg = await Match.findOne({
        liga_id: ligaId,
        faseTorneo: 'final',
        serieId: existingMatch.serieId,
        partidoSerie: 1,
      })
      const tieError = validateFinalLeg({ match: existingMatch, otherLeg: firstLeg, body: req.body })
      if (tieError) return res.status(400).json({ message: tieError })
    }

    const matchUpdate = { ...req.body, liga_id: ligaId }
    const fieldsToClear = ['marcadorTiempoExtraLocal', 'marcadorTiempoExtraVisitante', 'penalesLocal', 'penalesVisitante']
    const unset = Object.fromEntries(fieldsToClear
      .filter((field) => matchUpdate[field] === undefined || matchUpdate[field] === '')
      .map((field) => [field, 1]))
    fieldsToClear.forEach((field) => {
      if (unset[field]) delete matchUpdate[field]
    })
    const match = await Match.findOneAndUpdate(
      { _id: req.params.id, liga_id: ligaId },
      { $set: matchUpdate, ...(Object.keys(unset).length > 0 && { $unset: unset }) },
      { new: true, runValidators: true },
    )

    if (!match) return res.status(404).json({ message: 'Partido no encontrado' })
    await recalculateTeamStats([
      existingMatch.equipoLocal_id,
      existingMatch.equipoVisitante_id,
      match.equipoLocal_id,
      match.equipoVisitante_id,
    ])
    const torneoAviso = match.estado === 'finalizado' ? await advanceLeaguePlayoffs(ligaId) : ''
    const populatedMatch = await populateMatch(Match.findById(match._id))
    return res.json({ ...(await populatedMatch).toObject(), ...(torneoAviso && { torneoAviso }) })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Ese ID ya está en uso en esta liga' })
    }
    return res.status(400).json({ message: 'No se pudo actualizar el partido', error: error.message })
  }
})
