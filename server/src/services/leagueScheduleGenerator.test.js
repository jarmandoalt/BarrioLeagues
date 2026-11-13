import assert from 'node:assert/strict'
import test from 'node:test'
import { assignFixtureSchedules, calcularFechasJornadas, createRoundRobinFixtures } from './leagueScheduleGenerator.js'

const teams = [
  { _id: 'team-a', nombre: 'Alfa' },
  { _id: 'team-b', nombre: 'Bravo' },
  { _id: 'team-c', nombre: 'Charlie' },
  { _id: 'team-d', nombre: 'Delta' },
]

test('calcula fechas de jornada respetando días de juego y fecha J1', () => {
  assert.deepEqual(
    calcularFechasJornadas('2026-10-26', ['lunes', 'miércoles'], 'cada_lunes', 3),
    [
      { jornada: 1, fecha: '2026-10-26' },
      { jornada: 2, fecha: '2026-11-02' },
      { jornada: 3, fecha: '2026-11-09' },
    ],
  )
  assert.deepEqual(
    calcularFechasJornadas('2026-10-26', ['lunes', 'miércoles'], 'al_terminar_partidos', 3),
    [
      { jornada: 1, fecha: '2026-10-26' },
      { jornada: 2, fecha: '2026-10-28' },
      { jornada: 3, fecha: '2026-11-02' },
    ],
  )
})

test('inicia cada nueva jornada en el día de cambio seleccionado', () => {
  const expectedDates = {
    lunes: '2026-11-02',
    martes: '2026-10-27',
    miércoles: '2026-10-28',
    jueves: '2026-10-29',
    viernes: '2026-10-30',
    sábado: '2026-10-31',
    domingo: '2026-11-01',
  }
  const gameDays = Object.keys(expectedDates)

  Object.entries(expectedDates).forEach(([changeDay, expectedDate]) => {
    const dates = calcularFechasJornadas('2026-10-26', gameDays, changeDay, 2)
    assert.equal(dates[1].fecha, expectedDate)
  })
})

test('usa el cambio de jornada como límite para incluir los días de juego del fin de semana', () => {
  assert.deepEqual(
    calcularFechasJornadas('2026-10-24', ['sábado', 'domingo'], 'lunes', 4),
    [
      { jornada: 1, fecha: '2026-10-24' },
      { jornada: 2, fecha: '2026-10-26' },
      { jornada: 3, fecha: '2026-11-02' },
      { jornada: 4, fecha: '2026-11-09' },
    ],
  )
})

test('programa jornada inicial en la fecha configurada y respeta hora de inicio', () => {
  const generated = assignFixtureSchedules({
    fixtures: [{ jornada: 1, equipoLocal_id: 'team-a', equipoVisitante_id: 'team-b' }],
    existingMatches: [],
    courts: [{ _id: 'court-a', nombre: 'Cancha A', estado: 'activa', horarios: [
      { dia: 'lunes', horaInicio: '18:00' },
      { dia: 'lunes', horaInicio: '20:00' },
    ] }],
    referees: [{ _id: 'ref-a', estado: 'activo' }],
    durationMinutes: 60,
    startDate: '2026-10-26',
    startTime: '19:00',
    journeyDates: [{ jornada: 1, fecha: '2026-10-26' }],
  })
  assert.equal(generated.length, 1)
  assert.equal(generated[0].hora, '20:00')
  assert.equal(generated[0].fecha.getDate(), 26)
  assert.equal(generated[0].fecha.getMonth(), 9)
})

test('usa las fechas calculadas para programar jornadas posteriores', () => {
  const generated = assignFixtureSchedules({
    fixtures: [
      { jornada: 1, equipoLocal_id: 'team-a', equipoVisitante_id: 'team-b' },
      { jornada: 2, equipoLocal_id: 'team-c', equipoVisitante_id: 'team-d' },
    ],
    existingMatches: [],
    courts: [{ _id: 'court-a', nombre: 'Cancha A', estado: 'activa', horarios: [
      { dia: 'lunes', horaInicio: '18:00' },
      { dia: 'miércoles', horaInicio: '18:00' },
    ] }],
    referees: [{ _id: 'ref-a', estado: 'activo' }],
    durationMinutes: 60,
    startDate: '2026-10-26',
    startTime: '18:00',
    journeyDates: [
      { jornada: 1, fecha: '2026-10-26' },
      { jornada: 2, fecha: '2026-10-28' },
    ],
  })
  assert.deepEqual(generated.map((match) => match.fecha.getDate()), [26, 28])
})

test('genera y asigna horarios a todos los partidos de la fase regular', () => {
  const fixtures = createRoundRobinFixtures({
    teams,
    existingMatches: [],
    currentJourney: 0,
    format: 'LIGA_UNA_VUELTA',
  })
  const journeyDates = calcularFechasJornadas('2026-10-26', ['lunes'], 'lunes', 4)
  const generated = assignFixtureSchedules({
    fixtures,
    existingMatches: [],
    courts: ['court-a', 'court-b'].map((id) => ({
      _id: id,
      nombre: id,
      estado: 'activa',
      horarios: [{ dia: 'lunes', horaInicio: '18:00' }],
    })),
    referees: ['ref-a', 'ref-b'].map((id) => ({ _id: id, estado: 'activo' })),
    durationMinutes: 60,
    startDate: '2026-10-26',
    journeyDates,
    requireRefereeAvailability: true,
  })

  assert.equal(generated.length, 6)
  assert.deepEqual([...new Set(generated.map((match) => match.jornada))], [1, 2, 3])
  assert.ok(generated.every((match) => match.cancha_id && match.arbitro_id && match.fecha && match.hora))
  journeyDates.slice(0, 3).forEach(({ jornada, fecha }) => {
    const matchesInJourney = generated.filter((match) => match.jornada === jornada)
    assert.equal(matchesInJourney.length, 2)
    assert.ok(matchesInJourney.every((match) => match.fecha.getDate() === Number(fecha.slice(-2))))
  })
})

test('programa las 15 jornadas de una vuelta los fines de semana con cuatro árbitros', () => {
  const leagueTeams = Array.from({ length: 15 }, (_, index) => ({
    _id: `continentales-team-${index + 1}`,
    nombre: `Equipo ${String(index + 1).padStart(2, '0')}`,
  }))
  const courts = ['Cancha 1', 'Cancha 2', 'Cancha 3'].map((nombre) => ({
    _id: nombre,
    nombre,
    estado: 'activa',
    horarios: [
      { dia: 'sábado', horaInicio: '18:00' },
      { dia: 'sábado', horaInicio: '20:00' },
      { dia: 'domingo', horaInicio: '18:00' },
    ],
  }))
  const referees = ['Árbitro 1', 'Árbitro 2', 'Árbitro 3', 'Árbitro 4']
    .map((_nombre, index) => ({ _id: `referee-${index + 1}`, estado: 'activo' }))
  const journeyDates = calcularFechasJornadas('2026-10-24', ['sábado', 'domingo'], 'lunes', 16)
  const fixtures = createRoundRobinFixtures({
    teams: leagueTeams,
    existingMatches: [],
    currentJourney: 0,
    format: 'LIGA_UNA_VUELTA_CON_LIGUILLA_8',
  })
  const scheduled = assignFixtureSchedules({
    fixtures,
    existingMatches: [],
    courts,
    referees,
    durationMinutes: 60,
    startDate: '2026-10-24',
    journeyDates,
    requireRefereeAvailability: true,
  })
  const pairKeys = scheduled.map((match) => [match.equipoLocal_id, match.equipoVisitante_id].sort().join(':'))

  assert.equal(scheduled.length, 105)
  assert.equal(new Set(pairKeys).size, 105)
  assert.ok(scheduled.every((match) => match.cancha_id && match.arbitro_id && match.fecha && match.hora))
  assert.ok(scheduled.every((match) => [0, 6].includes(match.fecha.getDay())))
  assert.deepEqual(
    [...new Set(scheduled.map((match) => match.jornada))].map((jornada) => (
      scheduled.filter((match) => match.jornada === jornada).length
    )),
    Array(15).fill(7),
  )
})

test('distribuye cada jornada en todos sus días de juego antes del cambio de jornada', () => {
  const fixtures = [
    { jornada: 1, equipoLocal_id: 'team-a', equipoVisitante_id: 'team-b' },
    { jornada: 1, equipoLocal_id: 'team-c', equipoVisitante_id: 'team-d' },
    { jornada: 2, equipoLocal_id: 'team-b', equipoVisitante_id: 'team-a' },
    { jornada: 2, equipoLocal_id: 'team-d', equipoVisitante_id: 'team-c' },
  ]
  const generated = assignFixtureSchedules({
    fixtures,
    existingMatches: [],
    courts: [{
      _id: 'court-a',
      nombre: 'Cancha A',
      estado: 'activa',
      horarios: [
        { dia: 'viernes', horaInicio: '18:00' },
        { dia: 'sábado', horaInicio: '18:00' },
        { dia: 'domingo', horaInicio: '18:00' },
      ],
    }],
    referees: [{ _id: 'ref-a', estado: 'activo' }, { _id: 'ref-b', estado: 'activo' }],
    durationMinutes: 60,
    startDate: '2026-10-30',
    journeyDates: [
      { jornada: 1, fecha: '2026-10-30' },
      { jornada: 2, fecha: '2026-11-06' },
      { jornada: 3, fecha: '2026-11-13' },
    ],
  })
  const firstRound = generated.filter((match) => match.jornada === 1)
  const secondRound = generated.filter((match) => match.jornada === 2)

  assert.deepEqual(firstRound.map((match) => match.fecha.getDate()), [30, 31])
  assert.deepEqual(secondRound.map((match) => match.fecha.getDate()), [6, 7])
  assert.ok(firstRound.every((match) => [5, 6, 0].includes(match.fecha.getDay())))
})

test('la asignación automática evita empalmar al mismo árbitro en canchas distintas', () => {
  const generated = assignFixtureSchedules({
    fixtures: [
      { jornada: 1, equipoLocal_id: 'team-a', equipoVisitante_id: 'team-b' },
      { jornada: 1, equipoLocal_id: 'team-c', equipoVisitante_id: 'team-d' },
    ],
    existingMatches: [],
    courts: ['court-a', 'court-b'].map((id) => ({
      _id: id,
      nombre: id,
      estado: 'activa',
      horarios: [{ dia: 'lunes', horaInicio: '18:00' }, { dia: 'lunes', horaInicio: '18:30' }],
    })),
    referees: [{ _id: 'ref-a', estado: 'activo' }],
    durationMinutes: 30,
    startDate: '2026-10-26',
    startTime: '18:00',
    requireRefereeAvailability: true,
  })
  assert.equal(generated.length, 2)
  assert.ok(generated.every((match) => match.arbitro_id === 'ref-a'))
  assert.ok(Math.abs(generated[0].fecha.getTime() - generated[1].fecha.getTime()) >= 30 * 60 * 1000)
})

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
