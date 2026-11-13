import { Match } from '../models/Match.js'
import { Team } from '../models/Team.js'

export const recalculateTeamStats = async (teamIds) => {
  const uniqueIds = [...new Set(teamIds.map((id) => id?.toString()).filter(Boolean))]
  if (uniqueIds.length === 0) return

  const [teams, matches] = await Promise.all([
    Team.find({ _id: { $in: uniqueIds } }),
    Match.find({
      estado: 'finalizado',
      $or: [
        { equipoLocal_id: { $in: uniqueIds } },
        { equipoVisitante_id: { $in: uniqueIds } },
      ],
    }).sort({ jornada: 1, fecha: 1, createdAt: 1 }),
  ])
  const stats = new Map(teams.map((team) => [team._id.toString(), {
    pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, racha: [],
  }]))

  matches.forEach((match) => {
    const localId = match.equipoLocal_id.toString()
    const visitorId = match.equipoVisitante_id.toString()
    const local = stats.get(localId)
    const visitor = stats.get(visitorId)
    if (!local || !visitor) return

    const localResult = match.marcadorLocal > match.marcadorVisitante
      ? 'G'
      : match.marcadorLocal < match.marcadorVisitante ? 'P' : 'E'
    const visitorResult = localResult === 'G' ? 'P' : localResult === 'P' ? 'G' : 'E'

    for (const [teamStats, goalsFor, goalsAgainst, result] of [
      [local, match.marcadorLocal, match.marcadorVisitante, localResult],
      [visitor, match.marcadorVisitante, match.marcadorLocal, visitorResult],
    ]) {
      teamStats.pj += 1
      teamStats.gf += goalsFor
      teamStats.gc += goalsAgainst
      if (result === 'G') teamStats.pg += 1
      if (result === 'E') teamStats.pe += 1
      if (result === 'P') teamStats.pp += 1
      teamStats.racha.push(result)
    }
  })

  await Promise.all(teams.map((team) => {
    const teamStats = stats.get(team._id.toString())
    team.stats = {
      ...teamStats,
      dg: teamStats.gf - teamStats.gc,
      pts: (teamStats.pg * 3) + teamStats.pe,
    }
    team.racha = teamStats.racha.slice(-5)
    return team.save()
  }))
}