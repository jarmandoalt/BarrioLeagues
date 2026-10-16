import assert from 'node:assert/strict'
import test from 'node:test'
import { assignFixtureSchedules, createRoundRobinFixtures } from './leagueScheduleGenerator.js'

const teams = [
  { _id: 'team-a', nombre: 'Alfa' },
  { _id: 'team-b', nombre: 'Bravo' },
  { _id: 'team-c', nombre: 'Charlie' },
  { _id: 'team-d', nombre: 'Delta' },
]

test('genera una vuelta sin repetir cruces y con localías equilibradas', () => {
  const fixtures = createRoundRobinFixtures({ teams, existingMatches: [], currentJourney: 0, format: 'todos-vs-todos-una-vuelta' })
  const pairs = fixtures.map(({ equipoLocal_id, equipoVisitante_id }) => [equipoLocal_id, equipoVisitante_id].sort().join(':'))
  const homeCounts = new Map(teams.map((team) => [team._id, 0]))

  fixtures.forEach((fixture) => homeCounts.set(fixture.equipoLocal_id, homeCounts.get(fixture.equipoLocal_id) + 1))
  assert.equal(fixtures.length, 6)
  assert.equal(new Set(pairs).size, 6)
  assert.deepEqual([...homeCounts.values()].sort(), [1, 1, 2, 2])
})

test('equilibra localías cuando el número de equipos es impar', () => {
  const fixtures = createRoundRobinFixtures({ teams: teams.slice(0, 3), existingMatches: [], currentJourney: 0, format: 'todos-vs-todos-una-vuelta' })
  const homeCounts = new Map(teams.slice(0, 3).map((team) => [team._id, 0]))
  fixtures.forEach((fixture) => homeCounts.set(fixture.equipoLocal_id, homeCounts.get(fixture.equipoLocal_id) + 1))
  assert.equal(fixtures.length, 3)
  assert.deepEqual([...homeCounts.values()], [1, 1, 1])
})

test('genera la segunda vuelta invirtiendo la localía y respeta la jornada actual', () => {
  const firstLeg = createRoundRobinFixtures({ teams, existingMatches: [], currentJourney: 0, format: 'todos-vs-todos-una-vuelta' })
  const fixtures = createRoundRobinFixtures({ teams, existingMatches: [], currentJourney: 3, format: 'todos-vs-todos-ida-y-vuelta' })
  assert.equal(fixtures.length, 6)
  assert.ok(fixtures.every((fixture) => fixture.jornada >= 4))
  assert.deepEqual(
    fixtures.map(({ equipoLocal_id, equipoVisitante_id }) => `${equipoLocal_id}:${equipoVisitante_id}`).sort(),
    firstLeg.map(({ equipoLocal_id, equipoVisitante_id }) => `${equipoVisitante_id}:${equipoLocal_id}`).sort(),
  )
})

test('no repite los cruces guardados en el formato de una vuelta', () => {
  const initialFixtures = createRoundRobinFixtures({ teams, existingMatches: [], currentJourney: 0, format: 'todos-vs-todos-una-vuelta' })
  const existingMatches = [initialFixtures[0]]
  const fixtures = createRoundRobinFixtures({ teams, existingMatches, currentJourney: 0, format: 'todos-vs-todos-una-vuelta' })
  assert.equal(fixtures.length, initialFixtures.length - 1)
  assert.ok(fixtures.every(({ equipoLocal_id, equipoVisitante_id }) => `${equipoLocal_id}:${equipoVisitante_id}` !== `${existingMatches[0].equipoLocal_id}:${existingMatches[0].equipoVisitante_id}`))
  assert.ok(fixtures.every(({ equipoLocal_id, equipoVisitante_id }) => new Set([equipoLocal_id, equipoVisitante_id]).size === 2))
})

test('asigna solo días y horarios de cancha y no empalma partidos en la misma cancha', () => {
  const fixtures = [
    { jornada: 1, equipoLocal_id: 'team-a', equipoVisitante_id: 'team-b' },
    { jornada: 1, equipoLocal_id: 'team-c', equipoVisitante_id: 'team-d' },
  ]
  const now = new Date(2026, 9, 5, 12)
  const generated = assignFixtureSchedules({
    fixtures,
    existingMatches: [],
    courts: [{ _id: 'court-a', nombre: 'Cancha A', estado: 'activa', horarios: [{ dia: 'martes', horaInicio: '18:00' }] }],
    referees: [{ _id: 'ref-a', estado: 'activo' }, { _id: 'ref-b', estado: 'activo' }],
    durationMinutes: 60,
    now,
  })

  assert.equal(generated.length, 2)
  assert.ok(generated.every((match) => match.cancha_id === 'court-a' && match.hora === '18:00'))
  assert.notEqual(generated[0].fecha.getTime(), generated[1].fecha.getTime())
  assert.ok(generated.every((match) => match.fecha.getDay() === 2))
})

test('conserva horaInicio de horarios con propiedades en el prototipo', () => {
  const schedule = Object.create({ dia: 'martes', horaInicio: '18:00' })
  const generated = assignFixtureSchedules({
    fixtures: [{ jornada: 1, equipoLocal_id: 'team-a', equipoVisitante_id: 'team-b' }],
    existingMatches: [],
    courts: [{ _id: 'court-a', nombre: 'Cancha A', estado: 'activa', horarios: [schedule] }],
    referees: [{ _id: 'ref-a', estado: 'activo' }],
    durationMinutes: 60,
    now: new Date(2026, 9, 5, 12),
  })

  assert.equal(generated[0].hora, '18:00')
})
test('reparte una jornada completa en un solo día usando varias canchas aunque haya un solo árbitro', () => {
  const courts = ['a', 'b', 'c'].map((id) => ({
    _id: `court-${id}`,
    nombre: id,
    estado: 'activa',
    horarios: [{ dia: 'sábado', horaInicio: '19:00' }, { dia: 'sábado', horaInicio: '20:00' }],
  }))
  const fixtures = [['a', 'b'], ['c', 'd'], ['e', 'f'], ['g', 'h'], ['i', 'j']]
    .flatMap(([home, visitor]) => [1, 2].map((jornada) => ({ jornada, equipoLocal_id: `${home}${jornada}`, equipoVisitante_id: `${visitor}${jornada}` })))
  const generated = assignFixtureSchedules({
    fixtures,
    existingMatches: [],
    courts,
    referees: [{ _id: 'ref-a', estado: 'activo' }],
    durationMinutes: 30,
    now: new Date(2026, 9, 5, 12),
  })

  const slotKeys = generated.map((match) => `${match.fecha.getTime()}:${match.cancha_id}`)
  assert.equal(new Set(slotKeys).size, generated.length)
  ;[1, 2].forEach((jornada) => {
    const days = new Set(generated.filter((match) => match.jornada === jornada).map((match) => match.fecha.toDateString()))
    assert.equal(days.size, 1)
  })
})

test('sin horario asigna solo lo seleccionado y deja lo demás pendiente', () => {
  const generated = assignFixtureSchedules({
    fixtures: [{ jornada: 1, equipoLocal_id: 'team-a', equipoVisitante_id: 'team-b' }, { jornada: 1, equipoLocal_id: 'team-c', equipoVisitante_id: 'team-d' }],
    existingMatches: [],
    courts: [{ _id: 'court-a', nombre: 'A', estado: 'activa', horarios: [] }, { _id: 'court-b', nombre: 'B', estado: 'activa', horarios: [] }],
    referees: [{ _id: 'ref-a', estado: 'activo' }],
    durationMinutes: 60,
    assign: { arbitro: false, cancha: true, horario: false },
  })

  assert.deepEqual(generated.map((match) => match.cancha_id).sort(), ['court-a', 'court-b'])
  assert.ok(generated.every((match) => !('arbitro_id' in match) && !('fecha' in match) && !('hora' in match)))
})

test('con horario y sin cancha respeta la capacidad de canchas sin guardar la cancha', () => {
  const generated = assignFixtureSchedules({
    fixtures: [{ jornada: 1, equipoLocal_id: 'team-a', equipoVisitante_id: 'team-b' }, { jornada: 1, equipoLocal_id: 'team-c', equipoVisitante_id: 'team-d' }],
    existingMatches: [],
    courts: [{ _id: 'court-a', nombre: 'A', estado: 'activa', horarios: [{ dia: 'martes', horaInicio: '18:00' }] }],
    referees: [],
    durationMinutes: 60,
    assign: { arbitro: false, cancha: false, horario: true },
    now: new Date(2026, 9, 5, 12),
  })

  assert.notEqual(generated[0].fecha.getTime(), generated[1].fecha.getTime())
  assert.ok(generated.every((match) => !('cancha_id' in match) && !('arbitro_id' in match)))
})
