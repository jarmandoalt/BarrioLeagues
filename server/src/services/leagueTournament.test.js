import assert from 'node:assert/strict'
import test from 'node:test'
import { createRoundRobinFixtures } from './leagueScheduleGenerator.js'
import {
  createFinalFixtures,
  createQuarterfinalFixtures,
  createSemifinalFixtures,
  getExpectedRegularMatchCount,
  getSeriesResult,
} from './leagueTournament.js'

const teams = Array.from({ length: 8 }, (_, index) => ({
  _id: `team-${index + 1}`,
  nombre: `Equipo ${index + 1}`,
}))
const seeds = teams.map((team, index) => ({ equipoId: team._id, posicion: index + 1 }))

const leg = (phase, seriesId, partidoSerie, home, away, homeScore, awayScore, extra = {}) => ({
  _id: `${seriesId}-${partidoSerie}`,
  faseTorneo: phase,
  serieId: seriesId,
  partidoSerie,
  equipoLocal_id: home,
  equipoVisitante_id: away,
  marcadorLocal: homeScore,
  marcadorVisitante: awayScore,
  estado: 'finalizado',
  ...extra,
})

test('genera el calendario regular para los cuatro formatos', () => {
  const formats = [
    ['LIGA_IDA_VUELTA', 56],
    ['LIGA_UNA_VUELTA', 28],
    ['LIGA_IDA_VUELTA_CON_LIGUILLA_8', 56],
    ['LIGA_UNA_VUELTA_CON_LIGUILLA_8', 28],
  ]

  formats.forEach(([format, expected]) => {
    const fixtures = createRoundRobinFixtures({ teams, existingMatches: [], currentJourney: 0, format })
    assert.equal(fixtures.length, expected, format)
    assert.equal(getExpectedRegularMatchCount(teams.length, format), expected, format)
  })
})

test('siembra cuartos 1v8, 2v7, 3v6 y 4v5 a ida y vuelta', () => {
  const fixtures = createQuarterfinalFixtures(seeds, 10)
  assert.equal(fixtures.length, 8)
  assert.deepEqual(
    fixtures.filter((fixture) => fixture.partidoSerie === 1).map((fixture) => [fixture.equipoLocal_id, fixture.equipoVisitante_id]),
    [['team-1', 'team-8'], ['team-2', 'team-7'], ['team-3', 'team-6'], ['team-4', 'team-5']],
  )
  fixtures.filter((fixture) => fixture.partidoSerie === 2).forEach((fixture) => {
    const firstLeg = fixtures.find((candidate) => candidate.serieId === fixture.serieId && candidate.partidoSerie === 1)
    assert.equal(fixture.equipoLocal_id, firstLeg.equipoVisitante_id)
    assert.equal(fixture.equipoVisitante_id, firstLeg.equipoLocal_id)
  })
})

test('resuelve el empate de cuartos y semifinales por la mejor posición regular', () => {
  const qfResult = getSeriesResult([
    leg('cuartos', 'qf-1-8', 1, 'team-1', 'team-8', 2, 0),
    leg('cuartos', 'qf-1-8', 2, 'team-8', 'team-1', 2, 0),
  ], seeds, 'cuartos', 'qf-1-8')
  assert.equal(qfResult.winnerId, 'team-1')
  assert.equal(qfResult.desempatePor, 'posicionTabla')

  const sfResult = getSeriesResult([
    leg('semifinal', 'sf-1-4', 1, 'team-1', 'team-4', 0, 1),
    leg('semifinal', 'sf-1-4', 2, 'team-4', 'team-1', 0, 1),
  ], seeds, 'semifinal', 'sf-1-4')
  assert.equal(sfResult.winnerId, 'team-1')
  assert.equal(sfResult.desempatePor, 'posicionTabla')
})

test('cruza las semifinales con las llaves indicadas y ordena la final por siembra', () => {
  const quarterfinalWinners = new Map([
    ['qf-1-8', 'team-1'],
    ['qf-2-7', 'team-7'],
    ['qf-3-6', 'team-3'],
    ['qf-4-5', 'team-4'],
  ])
  const semifinals = createSemifinalFixtures(quarterfinalWinners, seeds, 20)
  assert.deepEqual(
    semifinals.filter((fixture) => fixture.partidoSerie === 1).map((fixture) => [fixture.equipoLocal_id, fixture.equipoVisitante_id]),
    [['team-1', 'team-4'], ['team-3', 'team-7']],
  )

  const finalists = new Map([['sf-1-4', 'team-4'], ['sf-2-3', 'team-3']])
  const final = createFinalFixtures(finalists, seeds, 30)
  assert.equal(final[0].equipoLocal_id, 'team-3')
  assert.equal(final[0].equipoVisitante_id, 'team-4')
  assert.equal(final.length, 2)
})

test('la final desempata primero en tiempo extra y luego en penales', () => {
  const firstLeg = leg('final', 'final', 1, 'team-1', 'team-2', 1, 0)
  const returnLeg = leg('final', 'final', 2, 'team-2', 'team-1', 1, 0, {
    marcadorTiempoExtraLocal: 1,
    marcadorTiempoExtraVisitante: 0,
  })
  const extraTimeResult = getSeriesResult([firstLeg, returnLeg], seeds, 'final', 'final')
  assert.equal(extraTimeResult.winnerId, 'team-2')
  assert.equal(extraTimeResult.desempatePor, 'tiempoExtra')

  returnLeg.marcadorTiempoExtraLocal = 0
  returnLeg.penalesLocal = 5
  returnLeg.penalesVisitante = 4
  const penaltyResult = getSeriesResult([firstLeg, returnLeg], seeds, 'final', 'final')
  assert.equal(penaltyResult.winnerId, 'team-2')
  assert.equal(penaltyResult.desempatePor, 'penales')
})
