import { League } from '../models/League.js'
import { Match } from '../models/Match.js'

// Dos partidos de igual duración se empalman si sus inicios distan menos que esa duración.
export const findOverlappingMatch = async ({ ligaId, courtId, startsAt, excludeId }) => {
  const league = await League.findOne({ slug: ligaId }).select('duracionPartido')
  const durationMs = (league?.duracionPartido || 60) * 60 * 1000
  const query = {
    liga_id: ligaId,
    cancha_id: courtId,
    estado: { $ne: 'suspendido' },
    fecha: { $gt: new Date(startsAt.getTime() - durationMs), $lt: new Date(startsAt.getTime() + durationMs) },
  }
  if (excludeId) query._id = { $ne: excludeId }
  return Match.findOne(query).select('hora fecha')
}
