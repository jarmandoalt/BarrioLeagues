const weekdays = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
const doubleRoundRobinFormat = 'todos-vs-todos-ida-y-vuelta'

const getId = (value) => value?._id?.toString() || value?.toString() || ''
const getPairKey = (localId, visitorId) => [localId, visitorId].sort().join(':')

export const createRoundRobinFixtures = ({ teams, existingMatches, currentJourney, format }) => {
  if (teams.length < 2) return []

  const rotation = [...teams].sort((first, second) => first.nombre.localeCompare(second.nombre))
  if (rotation.length % 2 === 1) rotation.push(null)

  const oneLegFixtures = []
  const teamIndexes = new Map(teams.map((team, index) => [getId(team), index]))
  const teamCount = teams.length
  const roundCount = rotation.length - 1
  for (let roundIndex = 0; roundIndex < roundCount; roundIndex += 1) {
    for (let pairIndex = 0; pairIndex < rotation.length / 2; pairIndex += 1) {
      const firstTeam = rotation[pairIndex]
      const secondTeam = rotation[rotation.length - 1 - pairIndex]
      if (!firstTeam || !secondTeam) continue

      const firstId = getId(firstTeam)
      const secondId = getId(secondTeam)
      const distance = (teamIndexes.get(secondId) - teamIndexes.get(firstId) + teamCount) % teamCount
      const isOppositePair = teamCount % 2 === 0 && distance === teamCount / 2
      const swapHome = isOppositePair
        ? (roundIndex + pairIndex) % 2 === 1
        : distance > Math.floor(teamCount / 2)
      const localId = swapHome ? secondId : firstId
      const visitorId = swapHome ? firstId : secondId
      oneLegFixtures.push({
        jornada: roundIndex + 1,
        equipoLocal_id: localId,
        equipoVisitante_id: visitorId,
      })
    }

    rotation.splice(1, 0, rotation.pop())
  }

  const fixtures = format === doubleRoundRobinFormat
    ? [...oneLegFixtures, ...oneLegFixtures.map((fixture) => ({
      jornada: fixture.jornada + roundCount,
      equipoLocal_id: fixture.equipoVisitante_id,
      equipoVisitante_id: fixture.equipoLocal_id,
    }))]
    : oneLegFixtures
  const existingPairs = new Set()
  const existingDirections = new Set()
  const occupiedTeamsByJourney = new Set()

  existingMatches.forEach((match) => {
    const localId = getId(match.equipoLocal_id)
    const visitorId = getId(match.equipoVisitante_id)
    if (!localId || !visitorId) return
    existingPairs.add(getPairKey(localId, visitorId))
    existingDirections.add(`${localId}:${visitorId}`)
    occupiedTeamsByJourney.add(`${match.jornada}:${localId}`)
    occupiedTeamsByJourney.add(`${match.jornada}:${visitorId}`)
  })

  const scheduledPairs = new Set()
  const scheduledDirections = new Set()
  return fixtures.filter((fixture) => {
    if (fixture.jornada <= currentJourney) return false
    const localId = fixture.equipoLocal_id
    const visitorId = fixture.equipoVisitante_id
    const pairKey = getPairKey(localId, visitorId)
    const directionKey = `${localId}:${visitorId}`

    if (occupiedTeamsByJourney.has(`${fixture.jornada}:${localId}`)
      || occupiedTeamsByJourney.has(`${fixture.jornada}:${visitorId}`)) return false
    if (format === doubleRoundRobinFormat) {
      if (existingDirections.has(directionKey) || scheduledDirections.has(directionKey)) return false
      scheduledDirections.add(directionKey)
    } else {
      if (existingPairs.has(pairKey) || scheduledPairs.has(pairKey)) return false
      scheduledPairs.add(pairKey)
    }
    return true
  })
}

const createScheduleDate = (day, time, weekOffset, now) => {
  const targetDay = weekdays.indexOf(day)
  const [hours, minutes] = time.split(':').map(Number)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const currentDay = (today.getDay() + 6) % 7
  const daysUntilSchedule = (targetDay - currentDay + 7) % 7 || 7
  return new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + daysUntilSchedule + (weekOffset * 7),
    hours,
    minutes,
  )
}

const overlapsInTime = (candidate, match, durationMs) => {
  if (match.estado === 'suspendido') return false
  const matchTime = new Date(match.fecha).getTime()
  return Number.isFinite(matchTime) && Math.abs(candidate.fecha.getTime() - matchTime) < durationMs
}

const hasCourtOrTeamConflict = (candidate, matches, durationMs) => {
  const candidateTeams = new Set([candidate.equipoLocal_id, candidate.equipoVisitante_id])
  return matches.some((match) => overlapsInTime(candidate, match, durationMs)
    && (getId(match.cancha_id) === candidate.cancha_id
      || candidateTeams.has(getId(match.equipoLocal_id))
      || candidateTeams.has(getId(match.equipoVisitante_id))))
}

const getLoad = (referee, matches) => matches.filter((match) => getId(match.arbitro_id) === getId(referee)).length

const pickReferee = (candidate, referees, matches, durationMs) => {
  const busyReferees = new Set(matches
    .filter((match) => candidate.fecha && overlapsInTime(candidate, match, durationMs))
    .map((match) => getId(match.arbitro_id)))
  const availableReferees = referees.filter((referee) => !busyReferees.has(getId(referee)))
  // Si todos están ocupados a esa hora se reutiliza el de menor carga.
  const pool = availableReferees.length > 0 ? availableReferees : referees
  return pool.reduce((best, referee) => (getLoad(referee, matches) < getLoad(best, matches) ? referee : best))
}
const getDayKey = (date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
const defaultAssignment = { arbitro: true, cancha: true, horario: true }

export const assignFixtureSchedules = ({ fixtures, existingMatches, courts, referees, durationMinutes, assign = defaultAssignment, now = new Date() }) => {
  if (fixtures.length === 0) return []

  const { arbitro, cancha, horario } = { ...defaultAssignment, ...assign }
  const activeCourts = courts.filter((court) => court.estado === 'activa')
  const activeReferees = referees.filter((referee) => referee.estado === 'activo')
  if (arbitro && activeReferees.length === 0) throw new Error('Registra al menos un árbitro activo para generar los partidos.')
  if ((cancha || horario) && activeCourts.length === 0) throw new Error('Registra al menos una cancha activa para generar los partidos.')

  const durationMs = durationMinutes * 60 * 1000
  const scheduledMatches = [...existingMatches]
  const generatedMatches = []
  const finalize = (match) => ({
    jornada: match.jornada,
    equipoLocal_id: match.equipoLocal_id,
    equipoVisitante_id: match.equipoVisitante_id,
    estado: 'programado',
    ...(arbitro && { arbitro_id: match.arbitro_id }),
    ...(cancha && { cancha_id: match.cancha_id }),
    ...(horario && { fecha: match.fecha, hora: match.hora }),
  })

  if (!horario) {
    fixtures.forEach((fixture) => {
      const match = { ...fixture, estado: 'programado' }
      if (cancha) {
        const court = activeCourts.reduce((best, item) => (
          scheduledMatches.filter((scheduled) => getId(scheduled.cancha_id) === getId(item)).length
            < scheduledMatches.filter((scheduled) => getId(scheduled.cancha_id) === getId(best)).length ? item : best))
        match.cancha_id = getId(court)
      }
      if (arbitro) match.arbitro_id = getId(pickReferee({}, activeReferees, scheduledMatches, durationMs))
      generatedMatches.push(finalize(match))
      scheduledMatches.push(match)
    })
    return generatedMatches
  }

  const scheduleTemplates = activeCourts.flatMap((court) => (court.horarios || [])
    .filter((schedule) => weekdays.includes(schedule.dia) && /^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.horaInicio))
    .map((schedule) => ({
      courtId: getId(court),
      courtName: court.nombre,
      dia: schedule.dia,
      horaInicio: schedule.horaInicio,
    })))
  if (scheduleTemplates.length === 0) throw new Error('Agrega horarios a las canchas activas para generar los partidos.')

  const maxWeeks = fixtures.length + existingMatches.length + 4
  const candidateSlots = []
  for (let weekOffset = 0; weekOffset < maxWeeks; weekOffset += 1) {
    scheduleTemplates.forEach((schedule) => candidateSlots.push({
      cancha_id: schedule.courtId,
      fecha: createScheduleDate(schedule.dia, schedule.horaInicio, weekOffset, now),
      hora: schedule.horaInicio,
    }))
  }
  candidateSlots.sort((first, second) => first.fecha - second.fecha || first.hora.localeCompare(second.hora) || first.cancha_id.localeCompare(second.cancha_id))

  const days = []
  candidateSlots.forEach((slot) => {
    const key = getDayKey(slot.fecha)
    if (days.at(-1)?.key !== key) days.push({ key, slots: [] })
    days.at(-1).slots.push(slot)
  })

  const placeFixtures = (journeyFixtures, slots) => {
    const placed = []
    for (const fixture of journeyFixtures) {
      const slot = slots.find((item) => !hasCourtOrTeamConflict({ ...fixture, ...item }, [...scheduledMatches, ...placed], durationMs))
      if (!slot) return null
      const candidate = { ...fixture, ...slot, estado: 'programado' }
      if (arbitro) candidate.arbitro_id = getId(pickReferee(candidate, activeReferees, [...scheduledMatches, ...placed], durationMs))
      placed.push(candidate)
    }
    return placed
  }

  const journeys = [...new Set(fixtures.map((fixture) => fixture.jornada))].sort((first, second) => first - second)
  let nextDayIndex = 0
  journeys.forEach((journey) => {
    const journeyFixtures = fixtures.filter((fixture) => fixture.jornada === journey)
    let placed = null
    let usedDayIndex = nextDayIndex
    // Cada jornada se juega completa en un mismo día; si no cabe, se reparte en los días siguientes.
    for (let dayIndex = nextDayIndex; dayIndex < days.length && !placed; dayIndex += 1) {
      placed = placeFixtures(journeyFixtures, days[dayIndex].slots)
      usedDayIndex = dayIndex
    }
    if (!placed) {
      placed = placeFixtures(journeyFixtures, days.slice(nextDayIndex).flatMap((day) => day.slots))
      usedDayIndex = days.findIndex((day) => day.key === getDayKey(placed?.at(-1)?.fecha ?? new Date(0)))
    }
    if (!placed) throw new Error('No hay horarios disponibles para acomodar todos los partidos sin empalmes.')

    generatedMatches.push(...placed.map(finalize))
    scheduledMatches.push(...placed)
    nextDayIndex = Math.max(usedDayIndex, 0) + 1
  })

  return generatedMatches
}
