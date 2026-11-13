import mongoose from 'mongoose'
import { CalendarChange } from '../models/CalendarChange.js'
import { Court } from '../models/Court.js'
import { League } from '../models/League.js'
import { Match } from '../models/Match.js'
import { Referee } from '../models/Referee.js'
import { findScheduleConflicts, isCourtBlocked, isRefereeBusyAt } from './calendarReschedulingRules.js'

const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/
const getId = (value) => value?._id?.toString() || value?.toString() || ''
const asDate = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
const isScheduledOn = (court, weekday, time) => court.horarios?.some(
  (slot) => slot.dia === weekday && slot.horaInicio === time,
)
const getBlockedMatches = (matches, dateTime, excludedIds) => {
  const excluded = new Set(excludedIds.map(String))
  return matches.filter((match) => (
    !excluded.has(getId(match._id))
    && match.estado !== 'suspendido'
    && match.fecha
    && isCourtBlocked(match.fecha, dateTime)
  ))
}
const createHttpError = (status, message) => Object.assign(new Error(message), { status })
const serializeSlot = (match) => ({
  fechaHora: match.fecha?.toISOString() || null,
  hora: match.hora || null,
  canchaId: getId(match.cancha_id) || null,
  arbitroId: getId(match.arbitro_id) || null,
})
const getExpectedSlot = (match) => ({
  fechaHora: match.fecha?.toISOString() || null,
  hora: match.hora || null,
  canchaId: getId(match.cancha_id) || null,
  arbitroId: getId(match.arbitro_id) || null,
})

const getLeagueScheduleResources = async (ligaId, session) => {
  const [courts, referees] = await Promise.all([
    Court.find({ liga_id: ligaId, estado: 'activa' }).session(session || null).lean(),
    Referee.find({ liga_id: ligaId, estado: 'activo' }).session(session || null).lean(),
  ])
  return { courts, referees }
}

export const getRecursosDisponibles = async (
  jornadaId,
  fechaHoraBuscada,
  partidoAIgnorarId,
  { ligaId, hora, dia, excluirPartidoIds = [], session } = {},
) => {
  const dateTime = asDate(fechaHoraBuscada)
  if (!dateTime || !Number.isInteger(Number(jornadaId)) || Number(jornadaId) < 1 || !ligaId
    || !timePattern.test(hora || '') || !dayNames.includes(dia)) {
    throw createHttpError(400, 'La jornada, fecha u horario solicitado no son válidos.')
  }
  const { courts, referees } = await getLeagueScheduleResources(ligaId, session)
  const ignoreIds = [...new Set([partidoAIgnorarId, ...excluirPartidoIds].filter(Boolean).map(String))]
  let matchesQuery = Match.find({ liga_id: ligaId, jornada: Number(jornadaId) })
  if (session) matchesQuery = matchesQuery.session(session)
  const matches = await matchesQuery.select('_id cancha_id arbitro_id fecha estado').lean()
  const blocked = getBlockedMatches(matches, dateTime, ignoreIds)
  const canchasLibres = courts
    .filter((court) => isScheduledOn(court, dia, hora)
      && !blocked.some((match) => getId(match.cancha_id) === getId(court._id)))
    .map(({ _id, nombre }) => ({ _id, nombre }))
  const arbitrosLibres = referees
    .filter((referee) => !matches.some((match) => (
      !ignoreIds.includes(getId(match._id))
      && match.estado !== 'suspendido'
      && getId(match.arbitro_id) === getId(referee._id)
      && match.fecha
      && isRefereeBusyAt(match.fecha, dateTime)
    )))
    .map(({ _id, nombre, telefono }) => ({ _id, nombre, telefono }))

  return { canchas_libres: canchasLibres, arbitros_libres: arbitrosLibres }
}

export const intentarMoverPartido = async (
  partidoId,
  nuevaFechaHora,
  nuevaCanchaId,
  nuevoArbitroId,
  { ligaId, jornada, hora, dia, excluirPartidoIds = [] } = {},
) => {
  const dateTime = asDate(nuevaFechaHora)
  if (!dateTime || !mongoose.isValidObjectId(partidoId) || !mongoose.isValidObjectId(nuevaCanchaId)
    || !mongoose.isValidObjectId(nuevoArbitroId)) {
    throw createHttpError(400, 'El partido, cancha, árbitro o fecha de destino no son válidos.')
  }
  const match = await Match.findOne({ _id: partidoId, liga_id: ligaId })
    .populate('equipoLocal_id', 'nombre nombreCorto')
    .populate('equipoVisitante_id', 'nombre nombreCorto')
    .lean()
  if (!match) throw createHttpError(404, 'Partido no encontrado en esta liga.')
  if (Number(match.jornada) !== Number(jornada)) {
    throw createHttpError(409, 'No se puede reasignar un partido fuera de su jornada.')
  }
  if (match.estado === 'finalizado') throw createHttpError(409, 'No se puede reasignar un partido finalizado.')

  const available = await getRecursosDisponibles(jornada, dateTime, partidoId, {
    ligaId,
    hora,
    dia,
    excluirPartidoIds,
  })
  const { courts, referees } = await getLeagueScheduleResources(ligaId)
  const court = courts.find((item) => getId(item._id) === String(nuevaCanchaId))
  const referee = referees.find((item) => getId(item._id) === String(nuevoArbitroId))
  if (!court || !isScheduledOn(court, dia, hora)) {
    throw createHttpError(400, 'La cancha debe estar activa y tener ese horario habilitado.')
  }
  if (!referee) throw createHttpError(400, 'El árbitro debe estar activo en esta liga.')

  const sameJourneyMatches = await Match.find({ liga_id: ligaId, jornada: Number(jornada) })
    .select('_id cancha_id arbitro_id fecha estado')
    .lean()
  const ignoredIds = [...new Set([partidoId, ...excluirPartidoIds].map(String))]
  const blocked = getBlockedMatches(sameJourneyMatches, dateTime, ignoredIds)
  const courtOccupant = blocked.find((item) => getId(item.cancha_id) === String(nuevaCanchaId))
  const refereeOccupant = sameJourneyMatches.find((item) => (
    !ignoredIds.includes(getId(item._id))
    && item.estado !== 'suspendido'
    && getId(item.arbitro_id) === String(nuevoArbitroId)
    && item.fecha
    && isRefereeBusyAt(item.fecha, dateTime)
  ))
  if (courtOccupant && refereeOccupant && getId(courtOccupant._id) !== getId(refereeOccupant._id)) {
    throw createHttpError(409, 'La cancha y el árbitro elegidos están ocupados por partidos distintos. Cambia uno de los recursos y vuelve a intentarlo.')
  }
  const occupant = courtOccupant || refereeOccupant
  if (occupant) {
    const populatedOccupant = await Match.findById(occupant._id)
      .populate('equipoLocal_id', 'nombre nombreCorto')
      .populate('equipoVisitante_id', 'nombre nombreCorto')
      .populate('cancha_id', 'nombre')
      .populate('arbitro_id', 'nombre')
      .lean()
    return {
      conflicto: true,
      recurso: courtOccupant ? 'cancha' : 'arbitro',
      arbitroOcupado: Boolean(refereeOccupant),
      partido_ocupante: {
        id: populatedOccupant._id,
        equipos: [populatedOccupant.equipoLocal_id?.nombre, populatedOccupant.equipoVisitante_id?.nombre].filter(Boolean).join(' vs '),
        hora: populatedOccupant.hora,
        fechaHora: populatedOccupant.fecha,
      },
      recursos_disponibles: available,
    }
  }

  if (!available.canchas_libres.some((item) => getId(item._id) === String(nuevaCanchaId))
    || !available.arbitros_libres.some((item) => getId(item._id) === String(nuevoArbitroId))) {
    throw createHttpError(409, 'El horario o los recursos cambiaron. Actualiza la disponibilidad y vuelve a elegir.')
  }
  return { conflicto: false, recursos_disponibles: available }
}

const matchesExpectedSlot = (match, expected) => {
  const current = getExpectedSlot(match)
  return current.fechaHora === (expected?.fechaHora || null)
    && current.hora === (expected?.hora || null)
    && current.canchaId === (expected?.canchaId || null)
    && current.arbitroId === (expected?.arbitroId || null)
}

const isTransactionUnsupported = (error) => (
  error.code === 20
  || error.codeName === 'IllegalOperation'
  || /replica set|mongos|transaction numbers are only allowed/i.test(error.message || '')
)

export const confirmarReasignaciones = async ({ ligaId, movimientos, operador }) => {
  if (!Array.isArray(movimientos) || movimientos.length < 1 || movimientos.length > 3
    || movimientos.some((move) => !move || typeof move !== 'object')) {
    throw createHttpError(400, 'La cadena debe incluir entre 1 y 3 movimientos.')
  }
  const ids = movimientos.map((move) => String(move.partidoId || ''))
  if (ids.some((id) => !mongoose.isValidObjectId(id)) || new Set(ids).size !== ids.length) {
    throw createHttpError(400, 'Cada movimiento debe corresponder a un partido válido y único.')
  }
  const jornada = Number(movimientos[0].jornada)
  if (!Number.isInteger(jornada) || jornada < 1
    || movimientos.some((move) => Number(move.jornada) !== jornada)) {
    throw createHttpError(400, 'Todos los movimientos deben permanecer dentro de la misma jornada.')
  }

  const session = await mongoose.startSession()
  let savedMatches = []
  try {
    await session.withTransaction(async () => {
      const leagueWrite = await League.updateOne(
        { slug: ligaId },
        { $inc: { calendarRevision: 1 } },
        { session },
      )
      if (!leagueWrite.matchedCount) throw createHttpError(404, 'Liga no encontrada.')

      const matches = await Match.find({ _id: { $in: ids }, liga_id: ligaId, jornada }).session(session)
      if (matches.length !== movimientos.length) {
        throw createHttpError(409, 'Uno o más partidos ya no pertenecen a la jornada seleccionada.')
      }
      const matchMap = new Map(matches.map((match) => [String(match._id), match]))
      const { courts, referees } = await getLeagueScheduleResources(ligaId, session)
      const courtMap = new Map(courts.map((court) => [getId(court._id), court]))
      const refereeMap = new Map(referees.map((referee) => [getId(referee._id), referee]))
      const planned = new Map()
      const changeDocuments = []

      for (const move of movimientos) {
        const match = matchMap.get(String(move.partidoId))
        if (!match) throw createHttpError(409, 'No se encontró uno de los partidos de la cadena.')
        if (match.estado === 'finalizado') throw createHttpError(409, 'No se puede reasignar un partido finalizado.')
        if (!matchesExpectedSlot(match, move.estadoAnterior)) {
          throw createHttpError(409, 'El calendario cambió mientras preparabas la reasignación. Cierra y vuelve a abrir la incidencia.')
        }
        const dateTime = asDate(move.fechaHora)
        const dateDay = move.dia
        if (!dateTime || !timePattern.test(move.hora || '') || !dayNames.includes(dateDay)) {
          throw createHttpError(400, 'Una fecha u hora de la reasignación no es válida.')
        }
        const courtId = move.canchaId ? String(move.canchaId) : null
        const refereeId = move.arbitroId ? String(move.arbitroId) : null
        if (courtId && (!mongoose.isValidObjectId(courtId)
          || !courtMap.has(courtId)
          || !isScheduledOn(courtMap.get(courtId), dateDay, move.hora))) {
          throw createHttpError(400, 'La cancha debe estar activa y habilitada para el día y horario elegidos.')
        }
        if (refereeId && (!mongoose.isValidObjectId(refereeId) || !refereeMap.has(refereeId))) {
          throw createHttpError(400, 'El árbitro debe estar activo en esta liga.')
        }
        const previous = getExpectedSlot(match)
        if (previous.fechaHora === dateTime.toISOString()
          && previous.hora === move.hora
          && previous.canchaId === courtId
          && previous.arbitroId === refereeId) {
          throw createHttpError(400, 'El destino debe cambiar al menos el horario, la cancha o el árbitro.')
        }
        planned.set(String(match._id), {
          fecha: dateTime,
          hora: move.hora,
          cancha_id: courtId,
          arbitro_id: refereeId,
        })
        changeDocuments.push({
          liga_id: ligaId,
          jornada,
          partido_id: match._id,
          cambio_anterior: serializeSlot(match),
          cambio_nuevo: {
            fechaHora: dateTime.toISOString(),
            hora: move.hora,
            canchaId: courtId,
            arbitroId: refereeId,
          },
          motivo: String(move.motivo || 'Reasignación por incidencia').slice(0, 300),
          operador,
        })
      }

      const journeyMatches = await Match.find({ liga_id: ligaId, jornada }).session(session).lean()
      const conflicts = findScheduleConflicts(journeyMatches, planned)
      if (conflicts.length) {
        throw createHttpError(409, 'La propuesta todavía tiene empalmes de cancha o árbitro. Actualiza los recursos y vuelve a intentarlo.')
      }

      for (const move of movimientos) {
        const match = matchMap.get(String(move.partidoId))
        const schedule = planned.get(String(match._id))
        match.fecha = schedule.fecha
        match.hora = schedule.hora
        match.cancha_id = schedule.cancha_id
        match.arbitro_id = schedule.arbitro_id
        await match.save({ session })
      }
      await CalendarChange.insertMany(changeDocuments, { session })
      savedMatches = ids
    }, { readPreference: 'primary', readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } })
  } catch (error) {
    if (isTransactionUnsupported(error)) {
      throw createHttpError(503, 'La reasignación atómica requiere que MongoDB esté configurado como replica set o clúster mongos. No se guardó ningún cambio.')
    }
    throw error.status ? error : createHttpError(400, error.message || 'No se pudieron confirmar las reasignaciones.')
  } finally {
    await session.endSession()
  }

  return Match.find({ _id: { $in: savedMatches }, liga_id: ligaId })
    .populate('equipoLocal_id', 'nombre nombreCorto')
    .populate('equipoVisitante_id', 'nombre nombreCorto')
    .populate('cancha_id', 'nombre')
    .populate('arbitro_id', 'nombre telefono')
    .lean()
}

export const inspectMoveCandidate = async ({ ligaId, partidoId, jornada, fechaHora, hora, dia, canchaId, arbitroId, excluirPartidoIds = [] }) => {
  if (!Array.isArray(excluirPartidoIds)) {
    throw createHttpError(400, 'La lista de partidos excluidos no es válida.')
  }
  const result = await intentarMoverPartido(partidoId, fechaHora, canchaId, arbitroId, {
    ligaId,
    jornada,
    hora,
    dia,
    excluirPartidoIds,
  })
  return result
}
