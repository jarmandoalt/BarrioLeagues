import { League } from '../models/League.js'
import { Match } from '../models/Match.js'
import { Team } from '../models/Team.js'

const playoffFormats = new Set([
  'LIGA_IDA_VUELTA_CON_LIGUILLA_8',
  'LIGA_UNA_VUELTA_CON_LIGUILLA_8',
])

export const isPlayoffFormat = (format) => playoffFormats.has(format)

export const getExpectedRegularMatchCount = (teamCount, format) => {
  const fixturesPerPair = [
    'LIGA_IDA_VUELTA',
    'LIGA_IDA_VUELTA_CON_LIGUILLA_8',
    'todos-vs-todos-ida-y-vuelta',
  ].includes(format) ? 2 : 1
  return (teamCount * (teamCount - 1) * fixturesPerPair) / 2
}

const getId = (value) => value?._id?.toString() || value?.toString() || ''
const seedPosition = (seeds, teamId) => seeds.find((seed) => getId(seed.equipoId) === getId(teamId))?.posicion ?? Infinity

const createSeriesFixture = (phase, seriesId, firstTeam, secondTeam, firstJourney) => [
  {
    faseTorneo: phase,
    serieId: seriesId,
    torneoKey: `${phase}:${seriesId}:1`,
    partidoSerie: 1,
    jornada: firstJourney,
    equipoLocal_id: getId(firstTeam),
    equipoVisitante_id: getId(secondTeam),
  },
  {
    faseTorneo: phase,
    serieId: seriesId,
    torneoKey: `${phase}:${seriesId}:2`,
    partidoSerie: 2,
    jornada: firstJourney + 1,
    equipoLocal_id: getId(secondTeam),
    equipoVisitante_id: getId(firstTeam),
  },
]

export const createQuarterfinalFixtures = (seeds, firstJourney) => {
  const byPosition = new Map(seeds.map((seed) => [seed.posicion, seed.equipoId]))
  return [
    ...createSeriesFixture('cuartos', 'qf-1-8', byPosition.get(1), byPosition.get(8), firstJourney),
    ...createSeriesFixture('cuartos', 'qf-2-7', byPosition.get(2), byPosition.get(7), firstJourney),
    ...createSeriesFixture('cuartos', 'qf-3-6', byPosition.get(3), byPosition.get(6), firstJourney),
    ...createSeriesFixture('cuartos', 'qf-4-5', byPosition.get(4), byPosition.get(5), firstJourney),
  ]
}

export const createSemifinalFixtures = (winners, seeds, firstJourney) => {
  const bySeed = (firstId, secondId) => seedPosition(seeds, firstId) < seedPosition(seeds, secondId)
    ? [firstId, secondId]
    : [secondId, firstId]
  const [one, four] = bySeed(winners.get('qf-1-8'), winners.get('qf-4-5'))
  const [two, three] = bySeed(winners.get('qf-2-7'), winners.get('qf-3-6'))
  return [
    ...createSeriesFixture('semifinal', 'sf-1-4', one, four, firstJourney),
    ...createSeriesFixture('semifinal', 'sf-2-3', two, three, firstJourney),
  ]
}

export const createFinalFixtures = (winners, seeds, firstJourney) => {
  const finalists = [...winners.values()].sort((first, second) => seedPosition(seeds, first) - seedPosition(seeds, second))
  return createSeriesFixture('final', 'final', finalists[0], finalists[1], firstJourney)
}

export const getSeriesResult = (matches, seeds, phase, seriesId) => {
  const legs = matches
    .filter((match) => match.faseTorneo === phase && match.serieId === seriesId)
    .sort((first, second) => first.partidoSerie - second.partidoSerie)
  if (legs.length !== 2 || legs.some((match) => match.estado !== 'finalizado')) return null

  const totals = new Map()
  legs.forEach((match) => {
    const localId = getId(match.equipoLocal_id)
    const visitorId = getId(match.equipoVisitante_id)
    totals.set(localId, (totals.get(localId) || 0) + match.marcadorLocal)
    totals.set(visitorId, (totals.get(visitorId) || 0) + match.marcadorVisitante)
  })

  const [[firstId, firstGoals], [secondId, secondGoals]] = [...totals]
  if (firstGoals !== secondGoals) {
    return { winnerId: firstGoals > secondGoals ? firstId : secondId, desempatePor: null, returnLeg: legs[1] }
  }

  if (phase !== 'final') {
    const winnerId = seedPosition(seeds, firstId) < seedPosition(seeds, secondId) ? firstId : secondId
    return { winnerId, desempatePor: 'posicionTabla', returnLeg: legs[1] }
  }

  const returnLeg = legs[1]
  const extraTimeLocal = returnLeg.marcadorTiempoExtraLocal
  const extraTimeVisitor = returnLeg.marcadorTiempoExtraVisitante
  if (Number.isInteger(extraTimeLocal) && Number.isInteger(extraTimeVisitor)) {
    const extraTotals = new Map(totals)
    const localId = getId(returnLeg.equipoLocal_id)
    const visitorId = getId(returnLeg.equipoVisitante_id)
    extraTotals.set(localId, extraTotals.get(localId) + extraTimeLocal)
    extraTotals.set(visitorId, extraTotals.get(visitorId) + extraTimeVisitor)
    const [[firstExtraId, firstExtraGoals], [secondExtraId, secondExtraGoals]] = [...extraTotals]
    if (firstExtraGoals !== secondExtraGoals) {
      return { winnerId: firstExtraGoals > secondExtraGoals ? firstExtraId : secondExtraId, desempatePor: 'tiempoExtra', returnLeg }
    }
  }

  if (Number.isInteger(returnLeg.penalesLocal) && Number.isInteger(returnLeg.penalesVisitante)
    && returnLeg.penalesLocal !== returnLeg.penalesVisitante) {
    return {
      winnerId: returnLeg.penalesLocal > returnLeg.penalesVisitante
        ? getId(returnLeg.equipoLocal_id)
        : getId(returnLeg.equipoVisitante_id),
      desempatePor: 'penales',
      returnLeg,
    }
  }

  return null
}

const getRegularMatches = (ligaId) => Match.find({
  liga_id: ligaId,
  $or: [{ faseTorneo: 'regular' }, { faseTorneo: { $exists: false } }],
}).sort({ jornada: 1 }).lean()

const createPlayoffMatches = async (ligaId, phase, fixtures, journeyOffset) => {
  const existing = await Match.find({ liga_id: ligaId, faseTorneo: phase }).select('_id').lean()
  if (existing.length || fixtures.length === 0) return 0

  const latest = await Match.find({ liga_id: ligaId }).sort({ jornada: -1 }).select('jornada').limit(1).lean()
  const firstJourney = (latest[0]?.jornada || 0) + journeyOffset
  const usedIds = new Set((await Match.find({ liga_id: ligaId }).select('idPartido').lean()).map((match) => match.idPartido))
  const documents = fixtures.map((fixture) => {
    let number = 100000
    while (number <= 999999) {
      const id = String(number)
      if (new Set(id).size === 6 && !usedIds.has(id)) {
        usedIds.add(id)
        return { ...fixture, idPartido: id, liga_id: ligaId, jornada: fixture.jornada + firstJourney - 1 }
      }
      number += 1
    }
    throw new Error('No quedan identificadores disponibles para crear los partidos de liguilla.')
  })

  try {
    await Match.insertMany(documents)
    return documents.length
  } catch (error) {
    if (error.code !== 11000) throw error
    const phaseExists = await Match.exists({ liga_id: ligaId, faseTorneo: phase })
    if (phaseExists) return 0
    throw error
  }
}

const persistSeriesWinners = async (matches, seeds, phase, seriesIds) => {
  const winners = new Map()
  for (const seriesId of seriesIds) {
    const result = getSeriesResult(matches, seeds, phase, seriesId)
    const returnLeg = matches.find((match) => match.faseTorneo === phase && match.serieId === seriesId && match.partidoSerie === 2)
    if (!result) {
      if (returnLeg?.desempatePor || returnLeg?.equipoGanador_id) {
        await Match.updateOne(
          { _id: returnLeg._id },
          { $unset: { desempatePor: 1, equipoGanador_id: 1 } },
        )
      }
      continue
    }
    winners.set(seriesId, result.winnerId)
    const update = { $set: { equipoGanador_id: result.winnerId } }
    if (result.desempatePor) update.$set.desempatePor = result.desempatePor
    else update.$unset = { desempatePor: 1 }
    await Match.updateOne({ _id: result.returnLeg._id }, update)
  }
  return winners
}

export const advanceLeaguePlayoffs = async (ligaId) => {
  const league = await League.findOne({ slug: ligaId }).select('formatoTorneo liguillaSeeds')
  if (!league || !isPlayoffFormat(league.formatoTorneo)) return ''

  const [teams, regularMatches] = await Promise.all([
    Team.find({ ligaId }).select('nombre stats').lean(),
    getRegularMatches(ligaId),
  ])
  const expectedCount = getExpectedRegularMatchCount(teams.length, league.formatoTorneo)
  if (expectedCount === 0 || regularMatches.length !== expectedCount || regularMatches.some((match) => match.estado !== 'finalizado')) return ''
  if (teams.length < 8) return 'La fase regular terminó, pero se requieren al menos 8 equipos para generar la liguilla.'

  let seeds = league.liguillaSeeds || []
  if (seeds.length === 0) {
    const orderedTeams = [...teams].sort((first, second) => (
      second.stats.pts - first.stats.pts
      || second.stats.dg - first.stats.dg
      || second.stats.gf - first.stats.gf
      || first.nombre.localeCompare(second.nombre)
    ))
    seeds = orderedTeams.slice(0, 8).map((team, index) => ({ equipoId: team._id, posicion: index + 1 }))
    await League.updateOne(
      {
        slug: ligaId,
        $or: [{ liguillaSeeds: { $exists: false } }, { liguillaSeeds: { $size: 0 } }],
      },
      { $set: { liguillaSeeds: seeds } },
    )
    const refreshedLeague = await League.findOne({ slug: ligaId }).select('liguillaSeeds').lean()
    seeds = refreshedLeague.liguillaSeeds
  }

  let createdCount = await createPlayoffMatches(ligaId, 'cuartos', createQuarterfinalFixtures(seeds, 1), 1)
  const allMatches = await Match.find({ liga_id: ligaId, faseTorneo: { $in: ['cuartos', 'semifinal', 'final'] } }).lean()
  const quarterfinalWinners = await persistSeriesWinners(allMatches, seeds, 'cuartos', ['qf-1-8', 'qf-2-7', 'qf-3-6', 'qf-4-5'])
  if (quarterfinalWinners.size === 4) {
    const semifinalFixtures = createSemifinalFixtures(quarterfinalWinners, seeds, 1)
    createdCount += await createPlayoffMatches(ligaId, 'semifinal', semifinalFixtures, 1)
  }

  const semifinals = await Match.find({ liga_id: ligaId, faseTorneo: 'semifinal' }).lean()
  const semifinalWinners = await persistSeriesWinners(semifinals, seeds, 'semifinal', ['sf-1-4', 'sf-2-3'])
  if (semifinalWinners.size === 2) {
    const finalFixtures = createFinalFixtures(semifinalWinners, seeds, 1)
    createdCount += await createPlayoffMatches(ligaId, 'final', finalFixtures, 1)
  }

  const finalMatches = await Match.find({ liga_id: ligaId, faseTorneo: 'final' }).lean()
  const finalWinner = await persistSeriesWinners(finalMatches, seeds, 'final', ['final'])
  if (finalWinner.size === 1) {
    const winner = await Team.findById(finalWinner.values().next().value).select('nombre').lean()
    return `Campeón de liga: ${winner.nombre}.`
  }
  if (createdCount) return `Se generaron ${createdCount} partido(s) nuevos de liguilla.`
  return ''
}

export const validateFinalLeg = ({ match, otherLeg, body }) => {
  if (match.faseTorneo !== 'final' || match.partidoSerie !== 2 || body.estado !== 'finalizado') return ''
  if (!otherLeg || otherLeg.estado !== 'finalizado') return 'Finaliza primero el partido de ida para resolver el global.'

  const totals = new Map()
  const addScore = (game, localScore, visitorScore) => {
    const localId = getId(game.equipoLocal_id)
    const visitorId = getId(game.equipoVisitante_id)
    totals.set(localId, (totals.get(localId) || 0) + localScore)
    totals.set(visitorId, (totals.get(visitorId) || 0) + visitorScore)
  }
  addScore(otherLeg, otherLeg.marcadorLocal, otherLeg.marcadorVisitante)
  addScore(match, body.marcadorLocal, body.marcadorVisitante)

  const [firstGoals, secondGoals] = [...totals.values()]
  if (firstGoals !== secondGoals) return ''

  const extraTimeLocal = body.marcadorTiempoExtraLocal
  const extraTimeVisitor = body.marcadorTiempoExtraVisitante
  if (!Number.isInteger(extraTimeLocal) || extraTimeLocal < 0
    || !Number.isInteger(extraTimeVisitor) || extraTimeVisitor < 0) {
    return 'El global está empatado: registra el marcador de tiempo extra.'
  }
  if (extraTimeLocal !== extraTimeVisitor) return ''

  const penaltiesLocal = body.penalesLocal
  const penaltiesVisitor = body.penalesVisitante
  if (!Number.isInteger(penaltiesLocal) || penaltiesLocal < 0
    || !Number.isInteger(penaltiesVisitor) || penaltiesVisitor < 0
    || penaltiesLocal === penaltiesVisitor) {
    return 'El global sigue empatado tras el tiempo extra: registra penales con un ganador.'
  }
  return ''
}
