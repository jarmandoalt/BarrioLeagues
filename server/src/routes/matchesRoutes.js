import { Router } from 'express'
import mongoose from 'mongoose'
import { Match } from '../models/Match.js'
import { Team } from '../models/Team.js'
import { Referee } from '../models/Referee.js'
import { Court } from '../models/Court.js'
import { League } from '../models/League.js'
import { findOverlappingMatch } from '../services/matchScheduling.js'
import { updateTeamStatsFromMatch } from '../services/matchStats.js'
import { assignFixtureSchedules, createRoundRobinFixtures } from '../services/leagueScheduleGenerator.js'

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
    const league = await League.findOne({ slug: ligaId }).select('jornada formatoTorneo duracionPartido')
    if (!league) return res.status(404).json({ message: 'Liga no encontrada' })

    const assign = Object.fromEntries(['arbitro', 'cancha', 'horario'].map((key) => [key, req.body?.asignar?.[key] === true]))
    const [teams, existingMatches, courts, referees] = await Promise.all([
      Team.find({ ligaId }).sort({ nombre: 1 }),
      Match.find({ liga_id: ligaId }).select('idPartido equipoLocal_id equipoVisitante_id arbitro_id cancha_id jornada fecha estado'),
      Court.find({ liga_id: ligaId, estado: 'activa' }),
      Referee.find({ liga_id: ligaId, estado: 'activo' }),
    ])
    const fixtures = createRoundRobinFixtures({
      teams,
      existingMatches,
      currentJourney: league.jornada ?? 0,
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
    })
    const usedIds = new Set(existingMatches.map((match) => match.idPartido))
    const matchDocuments = scheduledMatches.map((match) => ({
      ...match,
      idPartido: getAvailableMatchId(usedIds),
      liga_id: ligaId,
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
      const localTeam = teams.find((team) => team._id.equals(localId))
      const visitorTeam = teams.find((team) => team._id.equals(visitaId))
      await updateTeamStatsFromMatch(localTeam, visitorTeam, match.marcadorLocal, match.marcadorVisitante)
    }

    return res.status(201).json(await populateMatch(Match.findById(match._id)))
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

    const match = await Match.findOneAndUpdate(
      { _id: req.params.id, liga_id: ligaId },
      { ...req.body, liga_id: ligaId },
      { new: true, runValidators: true },
    )

    if (!match) return res.status(404).json({ message: 'Partido no encontrado' })
    return res.json(await populateMatch(Match.findById(match._id)))
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Ese ID ya está en uso en esta liga' })
    }
    return res.status(400).json({ message: 'No se pudo actualizar el partido', error: error.message })
  }
})


