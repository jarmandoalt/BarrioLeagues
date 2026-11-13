import dayjs from 'dayjs'
import { League } from '../models/League.js'
import { Match } from '../models/Match.js'

export const getDueJourneyNumber = (journeyDates, now = new Date()) => {
  const currentDate = dayjs(now)
  if (!currentDate.isValid()) return 0
  const today = currentDate.format('YYYY-MM-DD')

  return (Array.isArray(journeyDates) ? journeyDates : []).reduce((dueJourney, item) => {
    if (!item || !Number.isInteger(item.jornada) || typeof item.fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(item.fecha)) return dueJourney
    return item.fecha <= today ? Math.max(dueJourney, item.jornada) : dueJourney
  }, 0)
}

export const advanceDueLeagueJourneys = async (now = new Date()) => {
  const leagues = await League.find({
    estado: 'activa',
    'config.fechasJornadas.0': { $exists: true },
  }).select('slug nombre jornada config.fechasJornadas')
  const advanced = []

  for (const league of leagues) {
    const dueJourney = getDueJourneyNumber(league.config?.fechasJornadas, now)
    if (dueJourney <= league.jornada) continue

    const pendingMatches = await Match.updateMany(
      {
        liga_id: league.slug,
        jornada: { $lt: dueJourney },
        estado: { $in: ['en_curso', 'suspendido'] },
        marcadorLocal: { $in: [null, 0] },
        marcadorVisitante: { $in: [null, 0] },
        eventos: { $in: [null, []] },
      },
      { $set: { estado: 'programado' } },
    )
    const updatedLeague = await League.findOneAndUpdate(
      { _id: league._id, jornada: { $lt: dueJourney } },
      { $set: { jornada: dueJourney } },
      { new: true },
    ).select('slug nombre jornada')

    if (updatedLeague) {
      advanced.push({
        league: updatedLeague,
        pendingMatches: pendingMatches.modifiedCount,
      })
    }
  }

  return advanced
}
