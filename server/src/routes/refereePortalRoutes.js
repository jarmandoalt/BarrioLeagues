import { Router } from 'express'
import mongoose from 'mongoose'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import { League } from '../models/League.js'
import { Match } from '../models/Match.js'
import { Team } from '../models/Team.js'
import { Player } from '../models/Player.js'
import { updateTeamStatsFromMatch } from '../services/matchStats.js'

export const refereePortalRoutes = Router()

const verifyMatchLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Límite de intentos alcanzado. Intenta de nuevo en un minuto.' },
})

const submitReportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Demasiados reportes. Intenta de nuevo más tarde.' },
})

const requireDatabase = (res) => {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ message: 'MongoDB no está conectado' })
    return false
  }
  return true
}

const populateRefereeMatch = (query) => query
  .populate('equipoLocal_id', 'nombre nombreCorto')
  .populate('equipoVisitante_id', 'nombre nombreCorto')
  .populate('cancha_id', 'nombre')

const isCount = (value) => Number.isInteger(value) && value >= 0 && value <= 99

refereePortalRoutes.get('/ligas/:slug/arbitros/partidos-pendientes', async (req, res) => {
  if (!requireDatabase(res)) return

  try {
    const slug = req.params.slug.toLowerCase()
    const league = await League.findOne({ slug }).select('jornada')
    if (!league) return res.status(404).json({ message: 'Liga no encontrada' })

    const matches = await populateRefereeMatch(
      Match.find({ liga_id: slug, jornada: league.jornada, estado: 'programado' })
        .select('-idPartido -eventos -marcadorLocal -marcadorVisitante')
        .sort({ fecha: 1, hora: 1 }),
    )
    return res.json({ jornada: league.jornada, matches })
  } catch {
    return res.status(500).json({ message: 'No se pudieron cargar los partidos pendientes' })
  }
})

refereePortalRoutes.post('/ligas/:slug/arbitros/verificar-partido', verifyMatchLimiter, async (req, res) => {
  if (!requireDatabase(res)) return

  const slug = req.params.slug.toLowerCase()
  const { matchId, idPartido } = req.body || {}
  if (!mongoose.isValidObjectId(matchId) || typeof idPartido !== 'string' || !/^\d{6}$/.test(idPartido)) {
    return res.status(401).json({ message: 'No se pudo verificar el partido y el ID' })
  }

  try {
    const league = await League.findOne({ slug }).select('jornada')
    if (!league) return res.status(404).json({ message: 'Liga no encontrada' })

    const match = await populateRefereeMatch(Match.findOne({
      _id: matchId,
      liga_id: slug,
      jornada: league.jornada,
      estado: 'programado',
      idPartido,
    }).select('-idPartido'))
    if (!match) return res.status(401).json({ message: 'No se pudo verificar el partido y el ID' })
    if (!process.env.JWT_SECRET || Buffer.byteLength(process.env.JWT_SECRET) < 32) {
      return res.status(503).json({ message: 'La sesión de árbitro no está configurada' })
    }

    const accessToken = jwt.sign({ role: 'referee-report', leagueSlug: slug, jornada: league.jornada }, process.env.JWT_SECRET, {
      algorithm: 'HS256',
      subject: String(match._id),
      issuer: 'barrioleagues',
      audience: 'barrioleagues-referee-report',
      expiresIn: '2h',
    })

    const [localPlayers, visitorPlayers] = await Promise.all([
      Player.find({ equipo_id: match.equipoLocal_id._id, estado: 'activo' }).select('numero nombre_corto nombre_completo posicion').sort({ numero: 1 }).lean(),
      Player.find({ equipo_id: match.equipoVisitante_id._id, estado: 'activo' }).select('numero nombre_corto nombre_completo posicion').sort({ numero: 1 }).lean(),
    ])

    return res.json({ accessToken, jornada: league.jornada, match, players: { local: localPlayers, visitor: visitorPlayers } })
  } catch {
    return res.status(500).json({ message: 'No se pudo verificar el partido' })
  }
})

refereePortalRoutes.post('/ligas/:slug/arbitros/:matchId/reporte', submitReportLimiter, async (req, res) => {
  if (!requireDatabase(res)) return

  const slug = req.params.slug.toLowerCase()
  const authorization = req.get('authorization') || ''
  const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  let session

  try {
    session = jwt.verify(accessToken, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'barrioleagues',
      audience: 'barrioleagues-referee-report',
    })
  } catch {
    return res.status(401).json({ message: 'Verifica el ID del partido antes de guardar' })
  }

  if (session.role !== 'referee-report' || session.leagueSlug !== slug || session.sub !== req.params.matchId) {
    return res.status(403).json({ message: 'La sesión no corresponde a este partido' })
  }

  const { marcadorLocal, marcadorVisitante, eventos } = req.body || {}
  if (!isCount(marcadorLocal) || !isCount(marcadorVisitante) || !Array.isArray(eventos) || eventos.length > 200) {
    return res.status(400).json({ message: 'El marcador o los eventos no son válidos' })
  }

  try {
    const league = await League.findOne({ slug }).select('jornada')
    if (!league || league.jornada !== session.jornada) {
      return res.status(409).json({ message: 'La jornada cambió. Vuelve a seleccionar el partido.' })
    }

    const match = await Match.findOne({
      _id: session.sub,
      liga_id: slug,
      jornada: session.jornada,
      estado: 'programado',
    })
    if (!match) return res.status(409).json({ message: 'El partido ya fue reportado o dejó de estar pendiente' })

    const localId = String(match.equipoLocal_id)
    const visitorId = String(match.equipoVisitante_id)
    const [localPlayers, visitorPlayers] = await Promise.all([
      Player.find({ equipo_id: localId, estado: 'activo' }).select('numero').lean(),
      Player.find({ equipo_id: visitorId, estado: 'activo' }).select('numero').lean(),
    ])
    const localNumbers = new Set(localPlayers.map((player) => player.numero))
    const visitorNumbers = new Set(visitorPlayers.map((player) => player.numero))
    const validEvents = eventos.every((event) => {
      if (!event || ![localId, visitorId].includes(String(event.equipo_id))) return false
      const rosterNumbers = String(event.equipo_id) === localId ? localNumbers : visitorNumbers
      return ['GOL', 'TA', 'TR'].includes(event.tipo)
        && Number.isInteger(event.jugador_numero)
        && rosterNumbers.has(event.jugador_numero)
        && Number.isInteger(event.minuto)
        && event.minuto >= 0
        && event.minuto <= 120
    })
    if (!validEvents) return res.status(400).json({ message: 'Uno o más eventos del partido no son válidos' })

    const goalsLocal = eventos.filter((event) => event.tipo === 'GOL' && String(event.equipo_id) === localId).length
    const goalsVisitor = eventos.filter((event) => event.tipo === 'GOL' && String(event.equipo_id) === visitorId).length
    if (goalsLocal !== marcadorLocal || goalsVisitor !== marcadorVisitante) {
      return res.status(400).json({ message: 'El marcador debe coincidir con los eventos de gol registrados' })
    }

    const [localTeam, visitorTeam] = await Promise.all([
      Team.findOne({ _id: localId, ligaId: slug }),
      Team.findOne({ _id: visitorId, ligaId: slug }),
    ])
    if (!localTeam || !visitorTeam) return res.status(409).json({ message: 'No se encontraron los equipos de este partido' })

    const updatedMatch = await Match.findOneAndUpdate(
      { _id: match._id, liga_id: slug, jornada: session.jornada, estado: 'programado' },
      { $set: { marcadorLocal, marcadorVisitante, eventos, estado: 'finalizado' } },
      { new: true, runValidators: true },
    )
    if (!updatedMatch) return res.status(409).json({ message: 'El partido ya fue reportado por otra sesión' })

    await updateTeamStatsFromMatch(localTeam, visitorTeam, marcadorLocal, marcadorVisitante)
    return res.json({ saved: true, match: await populateRefereeMatch(Match.findById(updatedMatch._id)) })
  } catch (error) {
    return res.status(400).json({ message: 'No se pudo guardar el reporte', error: error.message })
  }
})